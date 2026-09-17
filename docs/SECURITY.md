# Security

This document explains the specific defenses in place and, honestly, their limits. No system is "100%
piracy-proof" — the goal here is to prevent unauthorized *access* to the storefront/files and make casual
redistribution meaningfully harder, not to promise impossible DRM.

## Defense in depth for authorization

Every protected surface is checked at **more than one layer**, so a bug or misconfiguration in any single
layer doesn't become a full bypass:

1. **`src/middleware.ts`** — redirects unauthenticated requests away from `/account`, `/purchases`, `/admin`,
   `/api/admin/*`, `/api/download/*` before any page/route code runs. Fast, but UX-oriented — never treated as
   the only gate. The actual per-route decision (redirect vs. 401/403 JSON vs. allow) is implemented as a
   pure function, `resolveMiddlewareAction()` in `src/lib/middleware-logic.ts`, kept deliberately separate
   from the Next.js request/response plumbing so it can be — and is — directly unit tested for every
   combination of route and session state (`tests/middleware-logic.test.ts`, 18 cases). This separation is
   what caught and prevents regressions like the admin-login redirect loop that existed in an earlier version
   of this file (see git history / `docs/ARCHITECTURE.md` if kept, or the test file's comments for the
   specific scenario).
2. **Every `/api/admin/*` route calls `requireAdmin()`** (`src/lib/session.ts`) independently, re-checking the
   session's role against the database-backed session. An attacker who somehow bypassed middleware (e.g. a
   future refactor that changes the matcher) would still hit this check.
3. **Every download route calls into `entitlement.service.ts`**, which queries `Purchase`/`Order` directly —
   it does not trust anything about "how the request got here."

## Payment integrity

- **Client tampering with price:** impossible by construction — `createOrderSchema` (in
  `src/lib/validation.ts`) has no price field at all. `createPendingOrder()` looks up the price from the
  `Product` row server-side. See `tests/validation.test.ts` for a test that explicitly attempts to smuggle a
  price field and confirms it's dropped.
- **Forged "payment successful" callback:** `verifyAndFulfillOrder()` (`order.service.ts`) verifies the
  Razorpay HMAC signature using `RAZORPAY_KEY_SECRET` (never exposed client-side), then independently
  re-fetches the payment from Razorpay's own API to confirm status and amount match what's expected — a
  spoofed client-side success message with no real payment behind it fails both checks.
- **Invalid/manipulated payment IDs:** the signature check ties `razorpay_order_id` + `razorpay_payment_id`
  together cryptographically; a mismatched pair fails verification.
- **Duplicated/replayed webhooks:** enforced at the database level via the unique constraint on
  `WebhookEvent.eventId` — see `docs/ARCHITECTURE.md` "Webhook idempotency."
- **Double fulfillment / accidental double-access grants:** `fulfillOrder()` checks `order.status === "PAID"`
  before doing anything, inside a transaction, so whichever of (client verify, webhook) arrives first wins and
  the second is a no-op. Covered by `tests/order-fulfillment.test.ts`.
- **Webhook spoofing:** every webhook request's signature is verified against `RAZORPAY_WEBHOOK_SECRET`
  (`verifyWebhookSignature` in `src/lib/razorpay.ts`) before the payload is even parsed for processing.

## Download / storage integrity

- **Insecure direct object references:** reel/product ids in URLs are meaningless without a matching `Purchase`
  row — `resolveReelAccess()` and `resolveBatchAccess()` re-derive ownership from the database on every
  request, not from anything in the URL/request implying ownership.
- **No permanent public links, ever:** the R2 bucket has no public access enabled. Every file — single reel or
  batch ZIP — is served through a presigned URL generated only after entitlement checks pass, expiring within
  minutes (`R2_SIGNED_URL_TTL_SECONDS` / `R2_BATCH_URL_TTL_SECONDS`).
- **Thumbnail/preview exception, and why it's still safe:** marketing images/preview clips need to be visible
  to anonymous storefront visitors. `src/app/api/media/*` routes handle this narrowly — they only sign a URL
  for a key that's registered as a *published* product's thumbnail/preview field in the database; an arbitrary
  key (e.g. guessing a real reel's storage key) is rejected with 404. This is the one deliberate exception to
  "never public," and it's scoped to non-sale marketing assets only.
- **Batch download validation:** `resolveBatchAccess()` checks every requested reel id belongs to the
  requested product and that the user's purchase actually covers it — a request mixing in an unauthorized
  reel id from a different product is rejected entirely, not silently filtered.
- **Rate limiting:** login, registration, order creation, single downloads, and batch downloads are all
  rate-limited per user/IP (`src/lib/rate-limit.ts`) to slow down brute-force and scraping-style abuse.
- **Download logging:** every download attempt (success or failure, with reason) is recorded in `DownloadLog`
  for troubleshooting and abuse detection, without collecting more personal data than IP/user-agent.
- **What this does *not* prevent:** once a legitimate, paying customer downloads an MP4 to their device, they
  physically possess the file and could redistribute it outside the platform. No download-delivery system
  (this one included) can prevent that after the fact — the license terms (Admin → Settings → Legal) exist to
  make the *policy* clear, not to make redistribution technically impossible.

## Admin panel

- Every admin API route independently verifies `role === 'ADMIN'` — see "Defense in depth" above.
- Admin actions (product changes, refunds, settings changes) are recorded in `AdminAuditLog` with the acting
  admin's id, action name, target, and metadata.
- Brute-force protection on login: after 8 failed attempts, the account is locked for 15 minutes
  (`src/lib/auth.ts`), on top of the IP-based rate limiter on the login/register routes.

## Customer account changes

- Changing an email or password (`/account` → Security) requires re-entering the **current password** first
  (`src/server/services/account.service.ts`), so a session left open on a shared device can't be used to
  silently take over the account's login credentials.
- Changing email checks the new address for uniqueness but returns a generic error either way — it never
  reveals whether a given email already belongs to a different account.
- A successful password change also clears any existing login lockout (`failedLoginCount` / `lockedUntil`),
  so a user who was locked out and has now proven they know the (new) password isn't stuck waiting out the
  cooldown.
- All three endpoints (`/api/account`, `/api/account/email`, `/api/account/password`) are independently
  rate-limited per user+IP, in addition to requiring an authenticated session (enforced by
  `src/middleware.ts` + `requireUser()`).

## Input validation & injection

- **SQL injection:** all database access goes through Prisma's parameterized queries — there is no raw SQL
  string concatenation anywhere in the app.
- **XSS:** React escapes rendered content by default; the only `dangerouslySetInnerHTML` usage in the codebase
  is for JSON-LD structured data on product pages, which is server-generated from typed fields, not raw user
  input.
- **CSRF:** NextAuth's session cookies are `httpOnly` and `sameSite`-protected by default; state-changing API
  routes require an authenticated session (checked server-side), and credentials are never read from
  query strings.
- **File upload abuse:** `/api/admin/uploads/presign` validates content-type against an explicit allowlist
  (`ALLOWED_VIDEO_TYPES` / `ALLOWED_IMAGE_TYPES` in `src/lib/r2.ts`) and enforces a max size before ever
  issuing an upload URL. Filenames are sanitized (`sanitizeFilename()`) to strip path separators and unsafe
  characters before being used to build an R2 object key, preventing path traversal.
- **Malicious file types:** only video/image MIME types are accepted; nothing uploaded is ever executed by the
  server — files are treated purely as opaque media objects.

## Logging

Structured JSON logs (`src/lib/logger.ts`) capture payment attempts/verification, webhook events, purchase
creation, access grants, download requests (success and failure), admin actions, and upload failures — with
timestamps and relevant ids. **Never logged:** passwords, password hashes, Razorpay secret keys, R2
credentials, full webhook signatures, or session tokens.

## Error handling

API routes never return raw stack traces or internal error messages to the client — see
`src/lib/api-error.ts`. Unexpected errors are logged in full server-side and returned to the client as a
generic "Something went wrong" message with an appropriate HTTP status.

## What you're responsible for

- Keeping your `.env`/host environment variables secret and rotated if ever leaked.
- Enabling HTTPS in production (see `docs/DEPLOYMENT.md`).
- Reviewing `AdminAuditLog` periodically if you add additional admins.
- Deciding your actual refund/license/terms policy — the shipped legal text is explicitly a placeholder.
