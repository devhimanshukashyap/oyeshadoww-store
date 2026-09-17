# Admin Guide

Day-to-day operating instructions for running the store. For initial setup, see the main `README.md`.

## Dashboard

`/admin` shows: total and today's revenue, total and today's orders, paid/failed/refunded order counts,
customer/product/reel counts, and recent orders/customers. This is deliberately not full of decorative charts
— just the numbers you'd actually check daily.

## Creating a new bundle

See the README's [Creating your first bundle](../README.md#creating-your-first-bundle) — the same steps apply
for every subsequent bundle: **Admin → Products → Create Bundle → upload reels → set prices → Publish.**

## Adding a new bundle category

**Admin → Settings → Categories** — type a name and click Add. It becomes immediately available in the
category dropdown when creating/editing a product, and as a filter pill on `/shop`.

## Replacing a reel's video file

Open the bundle (**Admin → Products → [bundle]**), find the reel in the list, and click the small **WM** or
**Clean** button on that row (whichever variant you're replacing), then choose the new file. It uploads and
overwrites that variant in place — the reel's title, description, and position stay the same, and existing
customers automatically get the new file the next time they download (their `Purchase` record points at the
`Reel`, not a specific file version).

## Removing a reel

Click the trash icon on the reel's row. This is a **soft delete**: the reel disappears from the storefront and
from new "My Purchases" views, but the underlying database row (and R2 file) isn't destroyed, and any customer
who already purchased the bundle before removal keeps their existing access to it. This matches the
requirement to never silently break a past customer's purchase.

## Reordering reels

Use the up/down arrow buttons on each reel row. Changes save immediately (no separate "save order" step).

## Publishing / unpublishing a bundle

**Admin → Products** — the **Publish/Unpublish** button toggles a bundle's status between `DRAFT` and
`PUBLISHED` without needing to open the full edit form. `DRAFT` bundles are invisible on the storefront but
still editable.

## Duplicating a bundle

Useful for creating "Volume 02" from "Volume 01"'s settings. **Admin → Products → Duplicate** copies the
bundle's metadata (name, category, prices, description, license text) into a new **Draft** bundle — it does
**not** copy reel files (each bundle's reels are unique media and must be uploaded fresh).

## Archiving / deleting a bundle

**Admin → Products → Archive.** This is also a soft delete — the bundle is hidden from the storefront and
marked non-purchasable, but its order history is preserved (see `docs/ARCHITECTURE.md` "Why soft deletes").
There's no hard-delete option in the UI on purpose.

## Refunding an order

**Admin → Orders**, find the order, click **Refund** (only shown for `PAID` orders). This:

1. Calls Razorpay's refund API for the actual payment.
2. Only if that succeeds, marks the order `REFUNDED` and revokes the customer's `Purchase` (their entitlement)
   in the database.
3. Sends the customer a refund confirmation email.

If Razorpay's refund call fails (e.g. network issue, already refunded on Razorpay's side), nothing changes in
your database — you'll see an error and can retry. The order/purchase history is kept even after a refund; it
just moves to `REFUNDED` status instead of being deleted.

## Managing settings

**Admin → Settings** covers branding, social links, contact info, footer text, legal page text (Terms,
Privacy, Refund Policy, and the default reel-usage license), and maintenance mode. Every field here is stored
in the database (`SiteSetting` table) and takes effect immediately across the site — no redeploy needed.

**Maintenance mode:** when enabled, customers see a simple "we'll be back shortly" screen instead of the
storefront; logged-in admins can still browse normally to verify things before turning it back off.

## Customers

**Admin → Customers** is a read-only directory (search by name/email, see order/purchase counts and join
date). There's no admin-side password reset flow in v1 — if a customer is locked out, direct them to try again
after the lockout window (15 minutes after repeated failed attempts), or manually clear their lock via Prisma
Studio if urgent (see the README's troubleshooting section).

## System Health

**Admin → Health** is a live, real-time diagnostics page — every status shown is the result of an actual
check made when the page loads (or when you click **Refresh**), never a hardcoded or assumed value.

**Overall status banner** — one of:
- **Healthy** — every configured service checked out fine.
- **Warning** — something is degraded but not broken (e.g. a slow database response, a webhook secret
  missing, some recent webhook failures).
- **Error** — something configured is actually failing (e.g. the database is unreachable, R2 credentials
  don't authenticate, Razorpay credentials are rejected).

A service that simply hasn't been configured yet (no R2 credentials in a fresh local install, for example)
is shown as its own distinct **Not Configured** status — it never counts as a failure and never drags the
overall banner down to Warning/Error, but it's also never shown as "Healthy," since nothing was actually
verified.

**Application** — confirms the app process is running, and shows the current environment (`development` /
`production`), the running build/version (`APP_VERSION` env var if you set one in your deploy pipeline,
falling back to the `package.json` version), and process uptime.

**Core services** — Database (a real `SELECT 1` query, with response time), Storage/R2 (a real `HeadBucket`
call against your configured bucket — shown as Not Configured if credentials aren't set), Payments/Razorpay
(a real authenticated API call — shown as Not Configured if keys aren't set; Warning if credentials work but
`RAZORPAY_WEBHOOK_SECRET` isn't set, since incoming webhooks would fail signature verification), and
Webhooks (based on your actual `WebhookEvent` history).

**Activity panels** — three read-only panels answering "when did this last actually happen":
- **Webhook activity** — last event received (type + status), last one that fully processed successfully,
  and how many failed in the last 24 hours.
- **Storage / upload activity** — last successful upload, last failed upload (if any) — the first place to
  check when a reel upload in the product editor didn't go through.
- **Payment activity** — last successful payment, last failed payment — the first place to check when a
  customer reports a checkout problem.

**Recent operational errors** — the last ~10 operational failures across the whole system (unexpected
server errors, webhook processing failures, payment failures, download failures, batch ZIP failures, and
upload verification failures) in the last 24 hours, each with a short, sanitized message and timestamp —
never any credentials, secrets, or full customer records. Use this alongside the activity panels above when
tracking down "why did X fail."

Click **Refresh** any time to re-run every check without leaving the page; if a refresh itself fails (e.g. a
network blip), the page keeps showing the last known-good status rather than clearing itself.

Check this page first whenever something seems broken.

## Audit trail

Every admin action (product changes, refunds, settings updates) is recorded in the `AdminAuditLog` table with
who did it and when. There's no UI for browsing it in v1 — query it via `npx prisma studio` if you need to
review recent admin activity (e.g. if you add a second admin account later).
