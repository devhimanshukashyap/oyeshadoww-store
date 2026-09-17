# Deployment

This covers deploying beyond what's in the main README's quick-start.

## Choosing a host

Any host that runs a long-lived Node.js process works. Recommended, roughly in order of simplicity:

| Host | Notes |
|---|---|
| Railway / Render | Easiest managed option: connect a git repo, set env vars, add a managed Postgres add-on. Both support long-running processes, so batch ZIP generation works without special handling. |
| Fly.io / a plain VPS + Docker | Use the included `Dockerfile`. Full control, still simple with `docker compose`/`fly deploy`. |
| Vercel | Works well for the storefront/admin pages themselves. **Caveat:** serverless function execution time limits can interrupt very large batch-ZIP generation (see below). Fine for small-to-medium bundles; for consistently large multi-GB batches, prefer a host with a long-running process, or move batch processing to a queue worker. |

Whichever you choose, you need: a reachable PostgreSQL database, the ability to set environment variables
securely, and a way to run a scheduled task (cron) for archive cleanup.

## Build & start

```bash
npm run build   # runs `prisma generate` then `next build` (output: "standalone")
npm start        # runs `next start`
```

Or with Docker:

```bash
docker build -t oyeshadoww-store .
docker run -p 3000:3000 --env-file .env oyeshadoww-store
```

## Database migrations in production

Never run `prisma migrate dev` against production (it's meant for local development and can prompt
interactively). Use:

```bash
npx prisma migrate deploy
```

Run this as part of your deploy pipeline (a release/predeploy step on Railway/Render, a build hook, or
manually before flipping traffic to a new version).

## Environment variables

Set every variable from `.env.example` in your host's environment variable configuration. Do not bake secrets
into the Docker image or commit them to git. At minimum for a working production deploy:

- `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

## Domain & HTTPS

1. Point your domain's DNS at your host (A/CNAME record per your host's instructions).
2. Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to your final `https://yourdomain.com` (no trailing slash).
3. Most managed hosts (Railway, Render, Vercel, Fly) provision and renew HTTPS certificates automatically once
   DNS is pointed correctly. On a bare VPS, put the app behind **Caddy** (simplest — automatic HTTPS) or
   nginx + certbot.

Example minimal Caddyfile for a VPS deployment:

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

## R2 CORS configuration

Because the admin's browser uploads files **directly** to R2 (not through the app server), your bucket needs
a CORS policy allowing `PUT` requests from your site's origin. In the Cloudflare dashboard: **R2 → your bucket
→ Settings → CORS Policy**, and add a rule allowing your production origin (and `http://localhost:3000` for
local development), method `PUT`, headers `*`.

## Razorpay: pointing the webhook at production

Update the webhook URL in the Razorpay dashboard to `https://yourdomain.com/api/webhooks/razorpay` (see the
main README's Razorpay setup section for the full steps). Do this for **both** test and live mode if you test
in production with test-mode keys before going live.

## Scheduled cleanup

Batch-download ZIPs are temporary (`R2_BATCH_URL_TTL_SECONDS` controls how long the signed URL — and thus the
practical lifetime of the archive — stays valid). Run the cleanup script on a schedule so expired archives
don't accumulate in your bucket:

```bash
npm run cleanup:archives
```

Options for scheduling:
- A cron job on a VPS: `0 * * * * cd /path/to/app && npm run cleanup:archives`
- A scheduled job/cron add-on on Railway/Render
- A scheduled GitHub Actions workflow that calls a small authenticated endpoint, or runs the script directly
  against production if your CI has network access to the database/R2 credentials (store them as GitHub
  Actions secrets, never in the workflow file)

## Scaling notes (read only if/when you need them)

- **Rate limiting** (`src/lib/rate-limit.ts`) is in-memory, correct for a single server instance. If you run
  multiple instances behind a load balancer, move it to a shared store (Redis/Upstash) — every call site
  already goes through the same `rateLimit(key, max, window)` function, so this is a one-file change.
- **Batch ZIP generation** runs on whichever instance received the request. At real scale, move
  `processBatchJob()` (in `src/server/services/download.service.ts`) behind a proper queue (BullMQ + Redis,
  or a cloud queue) so any worker can pick up the job — the function itself doesn't need to change, just how
  it's triggered.
