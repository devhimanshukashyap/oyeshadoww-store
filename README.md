# oyeshadoww — AI Reel Bundle Store

A production-ready digital storefront for selling AI-generated reel bundles (and, later, a course) under the
**@oyeshadoww** brand. Customers browse bundles, pay with Razorpay, and get instant, secure access to their
purchased reels from their account — individually or as a batch ZIP download. Everything sensitive (payment
verification, file storage, entitlements) is enforced server-side; nothing is ever trusted from the browser.

This README is written for someone who did **not** write the code. Start here.

---

## Table of contents

1. [Project overview](#project-overview)
2. [Technology stack](#technology-stack)
3. [Folder structure](#folder-structure)
4. [Local development](#local-development)
5. [Cloudflare R2 setup](#cloudflare-r2-setup)
6. [Razorpay setup](#razorpay-setup)
7. [Production deployment](#production-deployment)
8. [Admin login](#admin-login)
9. [Creating your first bundle](#creating-your-first-bundle)
10. [Uploading reels](#uploading-reels)
11. [Branding & typography](#branding--typography)
12. [Customer account management](#customer-account-management)
13. [Where do I change things? (change map)](#where-do-i-change-things)
14. [Monitoring & system health](#monitoring--system-health)
15. [Testing the full purchase/download workflow](#testing-the-full-purchasedownload-workflow)
16. [Troubleshooting](#troubleshooting)
17. [Security notes](#security-notes)
18. [Backup and recovery](#backup-and-recovery)
19. [Pre-launch checklist](#pre-launch-checklist)

Further reading: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/SECURITY.md`](docs/SECURITY.md) ·
[`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md)

---

## Project overview

**What it does:**

- Public storefront: home, shop (with category filters), product detail pages with pricing (watermarked /
  non-watermarked), previews, FAQ, legal pages.
- Customer accounts: register/login, "My Purchases," per-bundle reel list with preview, individual download,
  and multi-select **batch ZIP download**.
- Checkout: Razorpay Checkout, with **server-side price computation and payment verification** — a customer
  can never change what they're charged from the browser.
- Admin panel (`/admin`): dashboard, bundle/reel management (drag-and-drop upload straight to private
  storage), orders (with refund), customers, site settings (branding, social links, legal text), and a live
  system health page.
- All video files live in a **private** Cloudflare R2 bucket. Nothing is ever served from a permanent public
  URL — every download is a short-lived signed URL issued only after the server verifies you own the file.

**What it deliberately does NOT do (yet):** sell a course (the data model supports it — `Product.type` already
has a `COURSE` value — but there's no course-taking UI built, per the brief to not overbuild this now).

---

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | Single codebase for frontend, API routes, and server logic — no separate backend service to deploy/monitor. |
| Styling | Tailwind CSS | Fast, consistent, no CSS build headaches. |
| Database | PostgreSQL + Prisma ORM | Relational integrity for orders/entitlements matters a lot here; Prisma gives type-safe queries and migrations. |
| Auth | NextAuth (Credentials provider) | One `User` table with a `role` field covers both customers and the admin — simple now, extensible later. |
| Payments | Razorpay | Requested; built so verification (signature + webhook) is fully server-side. |
| Storage | Cloudflare R2 (S3-compatible) | Private object storage, no egress fees, works with the standard AWS SDK. |
| Email | Pluggable (`console` in dev, Resend in production) | Swappable without touching business logic. |
| Tests | Vitest | Fast, TypeScript-native, no extra config. |

---

## Folder structure

```
oyeshadoww-store/
├── prisma/
│   ├── schema.prisma        # the entire data model — start here to understand the system
│   └── seed.ts               # creates the first admin account + sample categories/bundle
├── scripts/
│   └── cleanup-archives.ts   # deletes expired batch-download ZIPs (run on a schedule)
├── src/
│   ├── app/
│   │   ├── (site)/           # public + customer-facing pages (home, shop, product, checkout, account...)
│   │   ├── admin/            # admin panel pages
│   │   ├── api/               # all API routes (payment, webhooks, downloads, admin CRUD...)
│   │   ├── layout.tsx         # root HTML shell, fonts, metadata
│   │   ├── sitemap.ts / robots.ts
│   │   └── not-found.tsx / error.tsx / global-error.tsx
│   ├── components/            # shared UI (Navbar, Footer, ProductCard, skeletons...) + components/admin/*
│   ├── lib/                   # db client, auth config, R2 client, Razorpay client, settings, validation...
│   ├── server/services/       # business logic: order, entitlement, download, product, dashboard, health
│   ├── types/                 # NextAuth type augmentation
│   └── middleware.ts          # route protection for /account, /purchases, /admin, /api/admin, /api/download
├── tests/                     # Vitest unit tests for the security-critical logic
├── docs/                      # deep-dive docs (architecture, deployment, security, admin guide)
├── .env.example
├── Dockerfile / docker-compose.yml
└── package.json
```

**The most important file to understand the business logic is `prisma/schema.prisma`** — read the comments in
it first. The second most important is `src/server/services/order.service.ts` (payment correctness) and
`src/server/services/entitlement.service.ts` (who can download what).

---

## Local development

### Prerequisites

- Node.js 18.18+ (20 LTS recommended)
- A PostgreSQL database (local install, Docker, or a free-tier hosted one like Neon/Supabase)
- A Razorpay account (test mode is fine to start)
- A Cloudflare account with R2 enabled

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in at least `DATABASE_URL` and `NEXTAUTH_SECRET` to get the app booting. Fill in
   Razorpay/R2 values when you're ready to test payments/uploads (see the dedicated sections below). Generate
   `NEXTAUTH_SECRET` with:
   ```bash
   openssl rand -base64 32
   ```

3. **Start a database** (skip if you already have one)
   ```bash
   docker compose up -d db
   ```
   This matches the default `DATABASE_URL` in `.env.example`.

4. **Run migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Seed the first admin account + sample data**
   ```bash
   npm run seed
   ```
   This creates an admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in your `.env`, three starter categories, and one **draft** sample bundle.

6. **Start the dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` for the storefront and `http://localhost:3000/admin/login` for the admin
   panel.

7. **Run tests** (optional but recommended before deploying changes)
   ```bash
   npm test
   ```

---

## Cloudflare R2 setup

R2 holds every reel file. **The bucket must stay private** — the app never marks it public; it always serves
files through short-lived signed URLs it generates itself.

1. In the Cloudflare dashboard, go to **R2 → Create bucket**. Name it something like `oyeshadoww-reels`. Leave
   public access **off** (this is the default — don't enable "Public Development URL" or attach a custom
   domain to the bucket).
2. Go to **R2 → Manage R2 API Tokens → Create API Token**. Give it **Object Read & Write** permission, scoped
   to your bucket if you want to be strict.
3. Copy the generated values into `.env`:
   - `R2_ACCOUNT_ID` — shown on the R2 overview page (also visible in your Cloudflare dashboard URL).
   - `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` — shown once when you create the token. Save them
     immediately; Cloudflare won't show the secret again.
   - `R2_BUCKET_NAME` — the bucket name you chose.
4. Leave `R2_ENDPOINT` empty — it's derived automatically from `R2_ACCOUNT_ID`
   (`https://<account_id>.r2.cloudflarestorage.com`). Only set it manually if you have a non-standard setup.

**How private access actually works here:** the admin panel asks the server for a *presigned upload URL*
(`/api/admin/uploads/presign`), uploads the file directly to R2 with it, then tells the server to *finalize*
it (`/api/admin/uploads/complete`), which verifies the object actually landed in R2 before marking it ready.
Customer downloads work the same way in reverse: after the server verifies you own the file
(`src/server/services/entitlement.service.ts`), it calls `createDownloadUrl()` in `src/lib/r2.ts`, which
generates a signed `GetObject` URL valid for a few minutes (`R2_SIGNED_URL_TTL_SECONDS`) — never a permanent
link.

---

## Razorpay setup

1. Create a Razorpay account at [razorpay.com](https://razorpay.com) and complete KYC when you're ready to go
   live (test mode works without it).
2. **Get your keys:** Dashboard → **Settings → API Keys → Generate Test Key** (or Live Key, once approved).
   Copy the **Key Id** and **Key Secret** into `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Also set
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the same Key Id (it's safe to expose — it identifies your account, it
   doesn't authorize charges by itself).
3. **Set up the webhook:** Dashboard → **Settings → Webhooks → Add New Webhook**.
   - URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Active events: at minimum `payment.captured`, `payment.failed`, `refund.processed` (you can enable more;
     unhandled event types are safely logged and ignored).
   - Copy the **Webhook Secret** shown into `.env` as `RAZORPAY_WEBHOOK_SECRET`.
4. **Test mode vs. live mode:** test mode keys start with `rzp_test_`; live keys with `rzp_live_`. Use test
   mode (with Razorpay's [test card/UPI numbers](https://razorpay.com/docs/payments/payments/test-card-upi-details/))
   until you've completed the [pre-launch checklist](#pre-launch-checklist), then switch every Razorpay `.env`
   value to the live equivalents and update the webhook URL/secret for live mode too (Razorpay keeps test and
   live webhooks separate).

**Why both a client-side verify call AND a webhook exist:** the browser calling `/api/payment/verify`
immediately after checkout gives the customer instant feedback, but a browser can close, crash, or lose
network right after paying. The webhook is Razorpay's server telling *your* server directly, so fulfillment
still happens even if the customer never sees the success page. Both paths call the same idempotent
`fulfillOrder()` function, so there's no risk of double-granting access — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Production deployment

The app is a standard Next.js app (`output: "standalone"` is set in `next.config.js`), so it runs on any
Node.js host. Three practical options:

### Option A — Docker (recommended for a VPS/Railway/Render/Fly.io)

```bash
docker build -t oyeshadoww-store .
docker run -p 3000:3000 --env-file .env oyeshadoww-store
```

### Option B — Plain Node host (Vercel, Railway, Render, etc. without Docker)

- **Build command:** `npm run build` (this also runs `prisma generate`)
- **Start command:** `npm start`
- Set all variables from `.env.example` in your host's environment variable settings — **never** commit a
  real `.env` file.

> **Batch ZIP downloads need a long-running Node process** (see `src/server/services/download.service.ts`) —
> they generate the archive in the background after the HTTP request returns. This works out of the box on
> Docker/VPS/Render/Railway. If you deploy to a platform with short serverless function timeouts (e.g. Vercel
> Hobby), very large batches could be interrupted; for high volume at scale, swap the fire-and-forget trigger
> in `createBatchJob()` for a real queue (BullMQ, SQS, etc.) — the `processBatchJob()` function is already a
> self-contained unit of work a queue worker can call directly.

### Steps common to any host

1. **Provision PostgreSQL** (managed Postgres from your host, or Neon/Supabase/RDS). Set `DATABASE_URL`.
2. **Run migrations against production** before or during your first deploy:
   ```bash
   npx prisma migrate deploy
   ```
3. **Seed the admin account** (one-time): `npm run seed`, or run the seed script's admin-creation logic via
   `npx tsx prisma/seed.ts` against your production `DATABASE_URL`.
4. **Set every environment variable** from `.env.example` — see the [security notes](#security-notes) for
   which ones are secret.
5. **Domain & HTTPS:** point your domain's DNS at your host, and set `NEXT_PUBLIC_SITE_URL` and
   `NEXTAUTH_URL` to the final `https://` URL. Most hosts (Vercel, Railway, Render, Fly) provision HTTPS
   automatically; on a bare VPS, put the app behind a reverse proxy (Caddy or nginx + Let's Encrypt) that
   terminates TLS.
6. **Point the Razorpay webhook** at `https://yourdomain.com/api/webhooks/razorpay` (see
   [Razorpay setup](#razorpay-setup)).
7. **Schedule the archive cleanup script.** Batch ZIPs are temporary — run this on a schedule (any cron,
   GitHub Actions scheduled workflow, or your host's built-in cron/scheduled-job feature) every hour or so:
   ```bash
   npm run cleanup:archives
   ```

Full details: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Admin login

Go to `/admin/login`. Use the email/password from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — these are
defined in your local `.env` file (copied from `.env.example`, defaults are documented and only take effect when you run `npm run seed` against a fresh
database. They are never committed to the repository and are not the credentials for any real/production
account — set your own values in `.env` before seeding.

**Change the password immediately after your first login.** There's no self-service "change password" screen
for the *admin* account in v1 (customers get one — see [Customer account management](#customer-account-management)
— admins don't yet) — for now, generate a new bcrypt hash and update it directly:

```bash
node -e "console.log(require('bcryptjs').hashSync('YourNewStrongPassword', 12))"
```

then update that admin user's `passwordHash` column in the database (via `npx prisma studio`, or your
database provider's SQL console):

```sql
UPDATE "User" SET "passwordHash" = '<paste the hash>' WHERE email = '';
```

To add a **second** admin, use the same approach: hash a password with the snippet above, then insert a row
with `role = 'ADMIN'` via Prisma Studio (`npx prisma studio`) or SQL.

### How admin authentication actually works

There is only one `User` table for both customers and admins — an "admin" is simply a `User` row with
`role = 'ADMIN'`. Authorization is checked in two independent layers, on every request, never just one:

1. **`src/middleware.ts`** intercepts requests matching `/admin/:path*` and `/api/admin/:path*` before any
   page or API route code runs. The actual routing decision is a small, pure, unit-tested function —
   `resolveMiddlewareAction()` in `src/lib/middleware-logic.ts` (see `tests/middleware-logic.test.ts`) — so
   it's easy to verify exactly what happens for every combination of route and session state:
   - No session, visiting `/admin/login` → page renders normally (HTTP 200).
   - No session, visiting `/admin` or any other `/admin/*` page → redirected to `/admin/login`.
   - A session that exists but isn't `role = 'ADMIN'` (e.g. a customer account), visiting any `/admin/*`
     page → redirected to `/admin/login` (never told why, and never shown any admin content).
   - A valid `ADMIN` session, visiting `/admin/*` → allowed through.
   - A valid `ADMIN` session, visiting `/admin/login` → redirected straight to `/admin` (no point showing
     the form again).
   - Any unauthenticated/unauthorized request to `/api/admin/*` → a plain `401`/`403` JSON response, never
     an HTML redirect (redirecting an API/fetch call to an HTML login page would break the caller).
2. **`requireAdmin()`** (`src/lib/session.ts`) is called independently inside every single `/api/admin/*`
   route handler and every admin page component. It re-checks the real, server-side session — never
   anything supplied by the client — before allowing the request to do anything. This means even if
   middleware were ever misconfigured or bypassed, no admin action or admin data would be reachable without
   this second check also passing.

The admin login form itself (`src/components/admin/admin-login-form.tsx`) adds one more UX-level check on
top of both of the above: after a successful credentials sign-in, it re-fetches the session and confirms
`role === 'ADMIN'` before redirecting to the dashboard — if a valid but non-admin account (e.g. a customer)
signs in through this form, it's immediately signed back out with a clear "This account doesn't have admin
access" message, rather than silently bouncing around. This is a convenience layer only; the two
server-side checks above are what actually enforce the boundary.

---

## Creating your first bundle

1. Log in at `/admin/login`.
2. **Admin → Products → Create Bundle.**
3. Fill in the name (e.g. "AI Snake Reels Vol. 01"), pick a category, write a description, and set your two
   prices (watermarked / non-watermarked — leave either blank to not sell that variant). Save as **Draft**.
4. You'll land on the bundle's edit page. Upload a **thumbnail** (and optionally a preview clip) under
   "Thumbnail & preview."
5. Under **Add reels**, choose whether you're uploading the *Watermarked* or *Non-watermarked* batch, then
   drag and drop your `.mp4`/`.mov`/`.webm` files (or tap to choose). Each file becomes its own reel,
   uploading directly to your private R2 bucket with a progress bar. If you need the *other* variant for the
   same reel later, use the small "WM" / "Clean" buttons on that reel's row to attach it.
6. Reorder reels with the up/down arrows, rename them, hide/unhide individual reels, or remove one (removing
   only hides it from new views — customers who already bought it keep access, per the brief's requirement to
   never destroy purchase history).
7. Once everything looks right, go back to **Bundle details** and change **Status** to **Published**, then
   **Save changes**.
8. The bundle immediately appears on `/shop` and is purchasable. No redeploy, no code changes.

---

## Uploading reels

- **Supported formats:** `.mp4`, `.mov`, `.webm`.
- **Size limit:** 500MB per file by default (generous for short-form vertical video) — change
  `MAX_VIDEO_BYTES` in `src/lib/r2.ts` if you need more.
- **Recommended:** export at the resolution/bitrate you actually want customers to receive — the file you
  upload is exactly the file that gets downloaded, there's no server-side re-encoding.
- Files upload **directly from your browser to R2** (not through the app server), so upload speed is limited
  by your own connection, not server capacity.

---

## Branding & typography

### The logo

The brand mark is a hand-built SVG ("S" monogram in a rounded gradient badge) — not a font glyph and not
generated at request time, so it renders identically everywhere with no runtime dependency:

- **`public/icon.svg`** — the source vector mark. This is what every in-app logo instance renders
  (`src/components/logo.tsx`), and what's referenced as the modern SVG favicon.
- **`public/favicon.ico`**, **`public/apple-touch-icon.png`**, **`public/icon-192.png`**,
  **`public/icon-512.png`** — pre-rendered raster fallbacks for browsers/devices that don't support SVG
  favicons, generated once from `icon.svg` (16/32/48px for the `.ico`, 180px for Apple touch, 192/512px for
  `site.webmanifest`).
- **`public/logo.svg`** — currently identical to `icon.svg`, kept as a separate file/name in case you want a
  visually distinct wordmark-included version later without touching the favicon asset.

**To change the logo:** replace `public/icon.svg` with your own (keep the `viewBox="0 0 64 64"` square
aspect for consistent rendering at every size), then regenerate the raster fallbacks from it — with
`rsvg-convert` (or any SVG-to-PNG tool) at 16/32/48/180/192/512px, and `icotool -c` (from `icoutils`) to
combine the 16/32/48px PNGs into `favicon.ico`. All in-app usages (navbar, footer, login, register, admin
login, admin sidebar, admin mobile header) automatically pick up the new file — none of them hardcode the
image beyond the one `<Logo />` component in `src/components/logo.tsx`.

The favicon is wired through Next.js's standard `metadata.icons` config in `src/app/layout.tsx` — there is
**no** `src/app/icon.tsx`/`ImageResponse`-based dynamic favicon in this project. An earlier version used
`next/og`'s `ImageResponse` to generate the favicon at request time, which broke on Windows because it tried
to resolve a bundled font file path at runtime and produced a malformed `file:` URL
(`.\file:\C:\Users\...\noto-sans-v27-latin-regular.ttf`) — `next/og` is not used anywhere in this project.

### Typography

Two font families, both loaded via `next/font/google` in `src/app/layout.tsx` — this is the **only** place
font files are loaded. `next/font/google` downloads and self-hosts the font files at **build time** and
serves them from your own domain; there is no runtime request to Google Fonts and no filesystem path
resolution at request time, so it's safe on Windows, in dev, and in production alike.

- **Space Grotesk** (`--font-display`) — headings, hero text, section titles. A geometric, modern display
  face that fits the AI/creator brand.
- **Inter** (`--font-body`) — body copy, navigation, forms, buttons, and the entire admin panel, chosen for
  readability at small sizes.

Both are exposed as CSS variables on `<html>` and consumed everywhere through the `font-display` / `font-sans`
Tailwind utilities (`tailwind.config.ts`) — no component hardcodes a raw `font-family`. The responsive type
scale (heading tracking/line-height, and fluid `clamp()`-based sizing for the hero/section titles via the
`.text-hero`, `.text-display-lg`, `.text-display-md`, and `.text-eyebrow` utility classes) is centralized in
`src/app/globals.css` under the "Typography system" comment block — headings scale smoothly between mobile
and desktop instead of jumping at breakpoints, and never render oversized on small screens.

---

## Customer account management

Logged-in customers manage everything about their account from **`/account`** (linked from the "Account"
menu in the navbar, and from the mobile menu):

- **Profile** — display name (no password required to change).
- **Security** — change email or password, each gated behind re-entering the current password (the same
  pattern as most account settings pages) so a session left open on a shared device can't be used to take
  over the account's login credentials. Email changes are checked for uniqueness without revealing whether a
  given email already belongs to someone else. Both flows live in `src/server/services/account.service.ts`
  and are covered by `tests/account.test.ts`.
- **Purchases** — a shortcut into `/purchases` (the bundle download experience).
- **Order history** — every order the customer has ever placed, regardless of status (paid, failed,
  refunded) — distinct from "My Purchases," which only ever shows currently-active entitlements.
- **Recent downloads** — the last 15 download attempts (single or batch), with success/failure, for the
  customer's own visibility into their activity.
- **Log out.**

Changing email or name updates the active session immediately (via NextAuth's `useSession().update()`)
without requiring a full logout/login — see the `jwt` callback's `trigger === "update"` handling in
`src/lib/auth.ts`. Changing a password does not need this, since passwords aren't stored in the session.

---

| I want to change... | Where |
|---|---|
| Website/brand name, `@oyeshadoww` handle, tagline | Admin → Settings → Branding |
| Instagram / YouTube / Facebook URLs | Admin → Settings → Social links |
| Contact email, footer text | Admin → Settings → Contact & footer |
| Terms & Conditions / Privacy / Refund policy text | Admin → Settings → Legal text |
| Default reel-usage license wording | Admin → Settings → Legal text ("Default license text") — or per-bundle under Admin → Products → (bundle) → SEO & license |
| Prices (watermarked / non-watermarked) | Admin → Products → (bundle) → Pricing |
| Bundles / reels | Admin → Products |
| Bundle categories | Admin → Settings → Categories |
| Logo / favicon | `public/icon.svg` (source mark) — see [Branding & typography](#branding--typography) for how to regenerate the `.ico`/PNG fallbacks |
| Colors | `tailwind.config.ts` (color tokens) and `src/app/globals.css` (base styles) |
| Fonts / typography scale | `src/app/layout.tsx` (which fonts are loaded) and `src/app/globals.css` "Typography system" (sizing/spacing) — see [Branding & typography](#branding--typography) |
| My account (profile/email/password/order history) | `/account` — see [Customer account management](#customer-account-management) |
| Database schema | `prisma/schema.prisma`, then `npx prisma migrate dev` |
| Payment settings (Razorpay keys/webhook secret) | Environment variables (`.env` locally, host dashboard in production) |
| Storage settings (R2 credentials/bucket) | Environment variables |
| Email provider | `EMAIL_PROVIDER` env var + `src/lib/email.ts` |
| Homepage hero copy / "How it works" steps | `src/app/(site)/page.tsx` |
| FAQ content | `src/app/(site)/faq/page.tsx` |
| Rate limits (login/download abuse protection) | `.env` (`RATE_LIMIT_*`) or `src/lib/rate-limit.ts` for the mechanism itself |
| Signed URL expiry times | `.env` (`R2_SIGNED_URL_TTL_SECONDS`, `R2_BATCH_URL_TTL_SECONDS`) |

---

## Monitoring & system health

**Admin → Health** is a lightweight, built-in monitoring layer — no external/paid monitoring service
required. Every status shown is a real, point-in-time check (or a real query against data the app already
records), never a placeholder:

- **Application** — confirms the process is running, and shows environment, version/build identifier
  (`APP_VERSION` if set, otherwise the `package.json` version), and uptime.
- **Database** — a real `SELECT 1` query with response time.
- **Storage (R2)** — a real `HeadBucket` call against your configured bucket. Shown as **Not Configured**
  (not "healthy," not "error") when R2 credentials simply haven't been set yet.
- **Payments (Razorpay)** — a real authenticated API call to confirm the key/secret pair actually works, not
  just that the environment variables are present. Also flags if `RAZORPAY_WEBHOOK_SECRET` is missing.
  Shown as **Not Configured** when no keys are set.
- **Webhooks** — last event received (type + status), last one that fully processed, and how many failed in
  the last 24 hours, all read from the `WebhookEvent` table.
- **Storage / upload activity** — last successful and last failed upload timestamp, for diagnosing "why
  didn't my reel upload go through."
- **Payment activity** — last successful and last failed payment timestamp, for diagnosing checkout issues.
- **Recent operational errors** — the last ~10 failures across the system in the last 24 hours (unexpected
  server errors, webhook/payment/download/upload/batch-ZIP failures), each with a short sanitized message —
  never credentials, secrets, or customer PII.

The overall status banner reads **Healthy**, **Warning**, or **Error** based on the worst individual check —
services that are simply **Not Configured** (e.g. R2 in a fresh local install with no bucket set up yet)
never count against it. A **Refresh** button re-runs every check on demand; if a refresh itself fails, the
page keeps showing the last known-good status instead of going blank.

This is intentionally built from data the app already persists for other reasons (orders, webhook events,
storage objects, download logs) plus one small in-memory recent-errors buffer (see
`src/lib/logger.ts` — resets on process restart, per-instance only) — no new database tables, no third-party
monitoring integration. See `docs/ADMIN_GUIDE.md` "System Health" for the full page-by-page walkthrough.

---

## Testing the full purchase/download workflow

1. Make sure `.env` has valid **test-mode** Razorpay keys and a working R2 bucket.
2. Publish a bundle with at least one real reel file uploaded (see above).
3. In an incognito window, go to the bundle's product page and click **Buy**.
4. Register/log in as a test customer, then complete checkout using a
   [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/) (e.g. card
   `4111 1111 1111 1111`, any future expiry, any CVV).
5. You should land on **Payment successful**, and the bundle should immediately appear under **My
   Purchases**.
6. Open the bundle: **Preview** a reel (plays inline), **Download** a reel individually (browser downloads
   the file), then select two or more reels and click **Download Selected** — watch it go through
   "Preparing… → Generating ZIP… → Ready," then download the ZIP.
7. In **Admin → Orders**, confirm the order shows as **PAID** with the correct amount, and try **Refund** on
   it — confirm the customer's purchase disappears from their My Purchases afterward.
8. Check **Admin → Health** — Database, Storage, Payments, and Webhooks should all show green (Webhooks will
   show green once at least one real webhook has been received; test this by completing step 4 above with
   your production webhook URL configured, or using Razorpay's webhook test-send feature in the dashboard).

---

## Troubleshooting

**Payment succeeded but the purchase is missing from "My Purchases"**
Check Admin → Orders for that order's status. If it's stuck on `PENDING`, the webhook likely hasn't arrived
yet (Razorpay retries automatically) or `RAZORPAY_WEBHOOK_SECRET` doesn't match what's configured in the
Razorpay dashboard. Check Admin → Health → **Webhook activity** for the last event received and its status,
and the **Recent operational errors** list for any `Webhook processing failed` entries; also check your
server logs for `webhook.invalid_signature` or `webhook.processing_failed`.

**Webhook not received**
Confirm the webhook URL in Razorpay's dashboard exactly matches `https://yourdomain.com/api/webhooks/razorpay`
(no trailing slash mismatch), that your site is publicly reachable over HTTPS, and that you copied the
webhook secret for the *same* mode (test vs. live) you're testing in. Admin → Health will show the Webhooks
check as **Not Configured** if `RAZORPAY_WEBHOOK_SECRET` isn't set at all. Razorpay's dashboard also shows a
delivery log per webhook with the response your server sent — check it for the exact error.

**Download fails / "You don't have access to this file"**
This means entitlement verification failed — most often because the order isn't actually `PAID` yet, the
purchase was refunded, or the specific file variant (watermarked vs. clean) wasn't uploaded for that reel.
Check the reel's WM/Clean badges in Admin → Products → (bundle).

**R2 upload fails**
Check Admin → Health → **Storage (R2)**. An **Error** status usually means `R2_ACCESS_KEY_ID` /
`R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` are wrong or the API token doesn't have write
permission; a **Not Configured** status means those variables aren't set at all. The **Storage / upload
activity** panel shows the last successful and last failed upload timestamps, and **Recent operational
errors** will show which specific object key failed verification. A stuck upload progress bar at 0% often
means a CORS issue — R2 buckets need a CORS policy allowing `PUT` from your site's origin; set this under the
bucket's **Settings → CORS Policy** in the Cloudflare dashboard, allowing your `NEXT_PUBLIC_SITE_URL` origin,
method `PUT`, and header `*`.

**Database connection problem**
Check Admin → Health → **Database** — an **Error** status includes the actual connection error and response
time — and confirm `DATABASE_URL` is reachable from wherever the app is deployed (a database that's only
reachable from your laptop won't work in production — check your provider's IP allowlist / connection
pooling settings).

**Login problem (customer or admin)**
After 8 failed attempts, an account is locked for 15 minutes (brute-force protection — see
`src/lib/auth.ts`). Wait, or clear `lockedUntil`/`failedLoginCount` for that user via Prisma Studio.

**Admin login redirects back to login**
Confirm the account's `role` is actually `ADMIN` in the database (Prisma Studio → `User` table).

**Batch download fails / stuck on "Generating ZIP…"**
Check Admin → Health → **Recent operational errors** for a `Batch ZIP generation failed` entry (it includes
the underlying error) — usually a missing/failed file in R2 for one of the selected reels, or (on a
serverless host with short timeouts) the process was killed mid-archive. See the deployment note above about
long-running batch generation.

**Payment fails / checkout doesn't complete**
Check Admin → Health → **Payments (Razorpay)** — a **Not Configured** status means the keys aren't set at
all; an **Error** status means the configured keys didn't authenticate against Razorpay's API (double-check
you copied the right test/live key pair). The **Payment activity** panel shows the last successful and last
failed payment timestamps.

---

## Security notes

- **Never commit `.env`** — it's already in `.gitignore`. Only `.env.example` (no real values) should be in
  version control.
- **Secrets** (never expose these to the browser, never log them): `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`, `DATABASE_URL`, `NEXTAUTH_SECRET`,
  `EMAIL_API_KEY`.
- **Safe to expose client-side:** `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_SITE_URL` — these identify
  accounts/endpoints, they don't authorize anything by themselves.
- **How signed URLs work:** every download — single reel or batch ZIP — is served via a presigned R2 URL
  generated server-side only after the server independently re-checks ownership against the database. URLs
  expire in a few minutes (`R2_SIGNED_URL_TTL_SECONDS`) and are never reused or made public.
- **Why the R2 bucket is private:** if the bucket were public, anyone with a guessed/leaked object key could
  download paid content directly, bypassing the entire purchase/entitlement system. Keeping it private means
  the database is the only source of truth for who can access what.
- **Why payment verification is server-side:** a browser can be modified by its user (dev tools, intercepted
  requests). The server never trusts a "payment succeeded" message from the browser alone — it verifies the
  Razorpay signature, re-checks the payment status directly against Razorpay's API, and separately relies on
  Razorpay's own server-to-server webhook. See `docs/SECURITY.md` for the full threat-model writeup.

---

## Backup and recovery

**Must be backed up:**
- **Database** (orders, purchases, users, product metadata, settings) — this is your business's source of
  truth. Use your database provider's automated backups (most managed Postgres providers, e.g. Neon/Supabase/
  RDS, offer daily backups out of the box) or run `pg_dump` on a schedule.
- **Source code** — keep it in a git repository (GitHub/GitLab/etc.), not just on your local machine.
- **Environment variables** — keep a secure copy of your production `.env` values somewhere safe (a password
  manager, not a plaintext file in the repo).

**Not automatically backed up by this project:**
- **R2 video files.** This project does not implement automatic R2-to-elsewhere backups. If you want
  redundancy for your source video files, keep your own original exports outside R2 (e.g. on your own drive
  or a separate cloud backup), or configure Cloudflare R2's or your own scheduled replication to a second
  bucket/provider. Don't assume uploaded reels are backed up anywhere beyond the single R2 bucket unless you
  set that up yourself.

---

## Pre-launch checklist

- [ ] Database configured and migrated (`npx prisma migrate deploy`)
- [ ] R2 bucket created, private, credentials in production env vars
- [ ] Razorpay test mode configured and a full test purchase completed
- [ ] Razorpay webhook configured and verified (Admin → Health shows green)
- [ ] Admin account created and password changed from the seed default
- [ ] At least one bundle created, with real reels uploaded, and published
- [ ] Successful payment tested end-to-end (see [Testing the full workflow](#testing-the-full-purchasedownload-workflow))
- [ ] Failed payment tested (use a Razorpay test failure card)
- [ ] Individual reel download tested
- [ ] Batch ZIP download tested
- [ ] Mobile tested (most traffic will come from Instagram on a phone)
- [ ] Desktop tested
- [ ] HTTPS enabled on your production domain
- [ ] All environment variables set in your production host (not just locally)
- [ ] Legal pages (Terms, Privacy, Refund Policy) updated with your actual policies — the shipped text is a
      placeholder
- [ ] Social links updated in Admin → Settings
- [ ] Favicon added (`src/app/favicon.ico`)
- [ ] Backup plan in place for the database
- [ ] Switched Razorpay from test mode to live mode keys + live webhook secret, and re-tested a real (small)
      purchase

---

Built as a modular monolith on purpose — one deployable app, one database, no unnecessary microservices —
per the brief's explicit instruction not to overbuild this.
