# Architecture

## Overview

This is a **modular monolith**: one Next.js application, one PostgreSQL database, one private object store.
There's no microservice split, no message queue, no separate backend — on purpose. The brief was explicit
that this should stay focused and maintainable by one person, not turn into "Amazon for AI content."

```
Browser
  │
  ├─ Public pages (SSR/RSC) ──────────────► reads product/category data
  ├─ Checkout (client component) ─────────► /api/payment/create-order, /api/payment/verify
  ├─ Account/Purchases (SSR + client) ────► /api/my-purchases, /api/download/*
  └─ Admin panel (SSR + client) ──────────► /api/admin/*

Next.js server (single deployable)
  │
  ├─ src/app/api/**            — HTTP boundary: parse, authenticate, validate, delegate
  ├─ src/server/services/**    — business logic (the only place decisions are made)
  ├─ src/lib/**                — infrastructure clients (db, R2, Razorpay, email, settings)
  └─ prisma/schema.prisma      — the single source of truth for data shape

PostgreSQL                Cloudflare R2 (private)             Razorpay
  orders, purchases,        reel video files, thumbnails,       payments, webhooks
  users, products, ...      temp batch ZIPs
```

## Why a modular monolith

- **One thing to deploy, one thing to monitor.** For a single-creator storefront, operational simplicity beats
  theoretical scalability you won't need for a long time.
- **Services layer keeps logic testable without a real server.** `src/server/services/*` never imports
  `next/server` — each service is a plain TypeScript module you can unit test in isolation (see `tests/`).
- **If you outgrow this:** the service layer is already the seam. `download.service.ts`'s
  `processBatchJob()` is a self-contained function — swapping the "fire and forget" trigger for a real queue
  (BullMQ, SQS) means changing `createBatchJob()`'s trigger line, not rewriting the ZIP logic. Similarly,
  `src/lib/rate-limit.ts` is in-memory by design for a single instance; swapping it for Redis/Upstash is a
  one-file change because every call site just calls `rateLimit(key, max, window)`.

## The data model, in one paragraph

A `Product` (a "bundle") has many `Reel`s. Each `Reel` can have a watermarked file and/or a clean file, each
represented by a `StorageObject` (the R2 object registry — separate from `Reel` so an upload that fails
partway through is visible and cleanable, not silently lost). When a customer pays, an `Order` (with
`OrderItem`s snapshotting the price actually charged) transitions to `PAID`, which creates/activates a
`Purchase` row — the **only** table any download code is allowed to trust for "does this user own this."
`WebhookEvent` records every Razorpay webhook by a unique id so retries/duplicates are inert.

## Payment correctness: the two-path fulfillment model

Fulfillment (marking an order `PAID` and creating `Purchase` rows) can be triggered from **two independent
paths**:

1. **Client verify** (`POST /api/payment/verify`) — called by the browser immediately after Razorpay
   Checkout's success callback. Verifies the HMAC signature, then independently re-fetches the payment from
   Razorpay's API to confirm status/amount (defense in depth — a signature alone isn't re-checked against
   Razorpay's live state).
2. **Webhook** (`POST /api/webhooks/razorpay`) — Razorpay's server calling ours directly. This is the
   *authoritative* path: it fires even if the customer's browser crashes, loses network, or never calls path
   1 at all.

Both paths call the same `fulfillOrder()` function in `order.service.ts`, which is wrapped in a Prisma
transaction and checks the order's current status before doing anything:

```ts
if (order.status === "PAID") return { alreadyProcessed: true }; // no-op, whichever path arrives second
```

This means **whichever path arrives first wins, and the second is a harmless no-op** — there's no race where
a customer ends up with two `Purchase` rows or the revenue dashboard double-counts an order.

**Why the server computes price, never the client:** `createPendingOrder()` in `order.service.ts` takes only
a `productId` and `variant` from the request body — it looks up the actual price from the `Product` row in
the database and uses *that* to create the Razorpay order. There is no code path where a price from the
request body is ever used. See `tests/validation.test.ts` for a test asserting the request schema has no
price field to smuggle in the first place.

## Webhook idempotency

Every inbound webhook is written to `WebhookEvent` keyed by a unique `eventId` **before** any processing
happens:

```ts
try {
  eventRow = await db.webhookEvent.create({ data: { eventId, ... } });
} catch {
  // unique constraint violation = we've already seen this event
  return NextResponse.json({ ok: true, duplicate: true });
}
```

If Razorpay redelivers the same event (their docs say to expect this), the second `create()` call hits the
`@unique` constraint on `eventId` and throws — we catch that specific case and acknowledge with `200` without
reprocessing. This is a stronger guarantee than "check if it exists first, then process" (which has a race
window); relying on the database's own uniqueness constraint closes that window entirely.

## Entitlement: the single choke point for downloads

`src/server/services/entitlement.service.ts` is the only place in the codebase allowed to decide "yes, serve
this file." Both the single-reel download route and the batch-download route call into it — neither
implements its own ownership check. This means:

- There's exactly one place to audit for access-control bugs.
- `tests/entitlement.test.ts` covers it in isolation without spinning up the HTTP layer.
- If a user owns both the watermarked and clean variant of a product, they always get the clean (better)
  file unless they explicitly request otherwise — implemented once, applied everywhere downloads happen.

## Storage: presigned URLs in both directions

**Upload (admin):** the browser never sends a video file to the Next.js server. It asks the server for a
presigned `PutObject` URL (`/api/admin/uploads/presign`, after the server validates content-type/size and
records a `StorageObject` row in `UPLOADING` status), uploads directly to R2 with that URL, then tells the
server to finalize (`/api/admin/uploads/complete`), which does a `HeadObject` call to confirm the file
actually exists in R2 before marking it `READY` and attaching it to a `Reel`. This keeps large video uploads
off the app server's memory/bandwidth entirely.

**Download (customer):** the reverse — the server never redirects to a permanent URL. After entitlement
checks pass, it calls `createDownloadUrl()` (a presigned `GetObject`, expiring in minutes) and returns that.

**Batch ZIP:** `processBatchJob()` pipes each authorized reel's R2 object stream into an `archiver` zip
stream, which is itself piped into a multipart upload back to R2 (`tmp-archives/{jobId}.zip`) via
`@aws-sdk/lib-storage`'s `Upload` helper. Nothing is buffered fully in memory at any point — this is what lets
it scale to large bundles without ballooning server RAM. Once ready, a presigned URL for the archive is handed
to the client; `scripts/cleanup-archives.ts` deletes expired archives on a schedule.

## Why soft deletes

`Product` and `Reel` both have a `deletedAt` column instead of being hard-deleted. `Order`/`OrderItem`/
`Purchase` reference them by id — hard-deleting a product a customer bought years ago would either cascade-
delete their purchase history or leave a dangling foreign key. Soft delete keeps historical orders intact
while removing the item from every *active* query (all storefront/admin list queries filter
`deletedAt: null`).

## Extending to a course later

`Product.type` is already an enum (`BUNDLE | DIGITAL_DOWNLOAD | COURSE`) rather than an assumption baked into
the schema. Adding course-taking UI later means: add course-specific tables (e.g. `Lesson`, `LessonProgress`)
referencing `Product`, add a `COURSE` branch in the product detail page's rendering, and reuse the exact same
`Purchase`/entitlement/checkout machinery that already exists — no rebuild of payments, accounts, or the admin
panel's product CRUD.
