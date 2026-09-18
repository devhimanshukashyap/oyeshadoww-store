import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { getR2Client, getBucketName } from "@/lib/r2";
import {
  getConfig as getCashfreeConfig,
  fetchCashfreeOrder,
} from "@/lib/cashfree";
import { getRecentErrorEvents } from "@/lib/logger";

/**
 * Admin -> Health data layer.
 *
 * Every status here reflects something the code actually verified in
 * this request — nothing is a hardcoded placeholder. "NOT_CONFIGURED" is
 * a distinct status from "HEALTHY"/"WARNING"/"ERROR" specifically so an
 * intentionally-absent optional integration (e.g. R2 credentials not set
 * yet in local dev) is never confused with a real failure.
 *
 * This is deliberately lightweight: no external monitoring service, no
 * new long-term storage. Point-in-time checks (database, R2, Cashfree)
 * call the real dependency directly. Activity/history checks (webhooks,
 * uploads, payments, recent errors) read from tables the app already
 * writes to for other reasons (WebhookEvent, StorageObject, Order,
 * DownloadLog, BatchDownloadJob) plus a small in-memory recent-errors
 * buffer (see src/lib/logger.ts) — no new infrastructure was added to
 * support this page.
 */

export type HealthStatus =
  | "HEALTHY"
  | "WARNING"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  latencyMs?: number;
}

export interface WebhookActivity {
  lastEventType: string | null;
  lastEventStatus: string | null;
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  recentFailureCount: number; // last 24h
}

export interface StorageActivity {
  lastSuccessfulUploadAt: string | null;
  lastFailedUploadAt: string | null;
}

export interface PaymentActivity {
  lastSuccessfulPaymentAt: string | null;
  lastFailedPaymentAt: string | null;
}

export interface RecentErrorItem {
  source: "system" | "webhook" | "payment" | "download" | "batch" | "upload";
  message: string;
  at: string;
}

export interface ApplicationInfo {
  status: HealthStatus;
  environment: string;
  version: string;
  uptimeSeconds: number;
}

export interface HealthSnapshot {
  generatedAt: string;
  overallStatus: HealthStatus;
  application: ApplicationInfo;
  checks: HealthCheck[]; // Database, Storage (R2), Payments (Cashfree), Webhooks — point-in-time
  webhookActivity: WebhookActivity;
  storageActivity: StorageActivity;
  paymentActivity: PaymentActivity;
  recentErrors: { items: RecentErrorItem[]; totalRecentCount: number };
}

const RECENT_WINDOW_MS =
  24 * 60 * 60 * 1000; // "recent" = last 24h, for failure counts / recent-error aggregation

function resolveAppVersion(): string {
  return process.env.APP_VERSION || process.env.npm_package_version || "unknown";
}

/**
 * Runs every check and assembles the full snapshot the health page
 * renders. Uses allSettled as a second safety net on top of each
 * individual check's own try/catch, so a bug in any single check can
 * never take down the whole page — a check that unexpectedly throws is
 * converted into a visible ERROR entry instead of crashing the request.
 */
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const results = await Promise.allSettled([
    checkDatabase(),
    checkStorage(),
    checkPayments(),
    checkWebhooksSummary(),
    getWebhookActivity(),
    getStorageActivity(),
    getPaymentActivity(),
    getRecentOperationalErrors(),
  ]);

  const [
    databaseR,
    storageR,
    paymentsR,
    webhooksSummaryR,
    webhookActivityR,
    storageActivityR,
    paymentActivityR,
    recentErrorsR,
  ] = results;

  const database = settledOrError(databaseR, "Database");
  const storage = settledOrError(storageR, "Storage (R2)");
  const payments = settledOrError(paymentsR, "Payments (Cashfree)");
  const webhooksSummary = settledOrError(webhooksSummaryR, "Webhooks");

  const webhookActivity: WebhookActivity =
    webhookActivityR.status === "fulfilled"
      ? webhookActivityR.value
      : {
          lastEventType: null,
          lastEventStatus: null,
          lastEventAt: null,
          lastSuccessAt: null,
          recentFailureCount: 0,
        };

  const storageActivity: StorageActivity =
    storageActivityR.status === "fulfilled"
      ? storageActivityR.value
      : {
          lastSuccessfulUploadAt: null,
          lastFailedUploadAt: null,
        };

  const paymentActivity: PaymentActivity =
    paymentActivityR.status === "fulfilled"
      ? paymentActivityR.value
      : {
          lastSuccessfulPaymentAt: null,
          lastFailedPaymentAt: null,
        };

  const recentErrors =
    recentErrorsR.status === "fulfilled"
      ? recentErrorsR.value
      : { items: [], totalRecentCount: 0 };

  const checks = [
    database,
    storage,
    payments,
    webhooksSummary,
  ];

  const application: ApplicationInfo = {
    status: "HEALTHY",
    environment: process.env.NODE_ENV ?? "unknown",
    version: resolveAppVersion(),
    uptimeSeconds: Math.round(process.uptime()),
  };

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: computeOverallStatus(checks),
    application,
    checks,
    webhookActivity,
    storageActivity,
    paymentActivity,
    recentErrors,
  };
}

function settledOrError(
  result: PromiseSettledResult<HealthCheck>,
  name: string,
): HealthCheck {
  if (result.status === "fulfilled") return result.value;

  return {
    name,
    status: "ERROR",
    detail: `Check failed to run: ${String(result.reason)}`,
  };
}

/**
 * ERROR beats WARNING beats HEALTHY.
 * NOT_CONFIGURED checks don't degrade the overall summary —
 * an optional integration you haven't set up yet isn't a failure.
 */
function computeOverallStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some((c) => c.status === "ERROR")) return "ERROR";
  if (checks.some((c) => c.status === "WARNING")) return "WARNING";
  return "HEALTHY";
}

// ---------------------------------------------------------------------------
// Point-in-time checks
// ---------------------------------------------------------------------------

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const start = Date.now();

    await db.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - start;

    if (latencyMs > 2000) {
      return {
        name: "Database",
        status: "WARNING",
        detail: `Responding, but slow (${latencyMs}ms)`,
        latencyMs,
      };
    }

    if (latencyMs > 500) {
      return {
        name: "Database",
        status: "WARNING",
        detail: `Responded in ${latencyMs}ms`,
        latencyMs,
      };
    }

    return {
      name: "Database",
      status: "HEALTHY",
      detail: `Responded in ${latencyMs}ms`,
      latencyMs,
    };
  } catch (err) {
    return {
      name: "Database",
      status: "ERROR",
      detail: `Connection failed: ${sanitizeError(err)}`,
    };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  const configured =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!process.env.R2_BUCKET_NAME;

  if (!configured) {
    return {
      name: "Storage (R2)",
      status: "NOT_CONFIGURED",
      detail:
        "R2 credentials/bucket not set — uploads and downloads are disabled until configured",
    };
  }

  try {
    const start = Date.now();

    await getR2Client().send(
      new HeadBucketCommand({
        Bucket: getBucketName(),
      }),
    );

    const latencyMs = Date.now() - start;

    return {
      name: "Storage (R2)",
      status: "HEALTHY",
      detail: `Bucket "${getBucketName()}" reachable`,
      latencyMs,
    };
  } catch (err) {
    return {
      name: "Storage (R2)",
      status: "ERROR",
      detail: `Bucket unreachable — check credentials/bucket name: ${sanitizeError(err)}`,
    };
  }
}

async function checkPayments(): Promise<HealthCheck> {
  let config;

  try {
    config = getCashfreeConfig();
  } catch (err) {
    return {
      name: "Payments (Cashfree)",
      status: "ERROR",
      detail: `Cashfree configuration error: ${sanitizeError(err)}`,
    };
  }

  try {
    const latestOrder = await db.order.findFirst({
      where: {
        cashfreeOrderId: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        cashfreeOrderId: true,
      },
    });

    if (!latestOrder?.cashfreeOrderId) {
      return {
        name: "Payments (Cashfree)",
        status: "WARNING",
        detail:
          config.environment === "sandbox"
            ? "Cashfree configured · Sandbox environment · No Cashfree orders yet to verify API access"
            : "Cashfree configured · Production environment · No Cashfree orders yet to verify API access",
      };
    }

    const startedAt = Date.now();

    await fetchCashfreeOrder(latestOrder.cashfreeOrderId);

    const latencyMs = Date.now() - startedAt;

    return {
      name: "Payments (Cashfree)",
      status: "HEALTHY",
      detail:
        config.environment === "sandbox"
          ? `Cashfree API authenticated · Sandbox · ${latencyMs}ms`
          : `Cashfree API authenticated · Production · ${latencyMs}ms`,
    };
  } catch (err) {
    return {
      name: "Payments (Cashfree)",
      status: "ERROR",
      detail: `Cashfree API check failed: ${sanitizeError(err)}`,
    };
  }
}

/**
 * Summary status for the point-in-time checks list.
 * See getWebhookActivity() for the detailed timestamps/counts shown separately
 * on the page.
 */
async function checkWebhooksSummary(): Promise<HealthCheck> {
  let configured = false;

  try {
    const config = getCashfreeConfig();
    configured = !!config.secretKey;
  } catch {
    configured = false;
  }

  if (!configured) {
    return {
      name: "Webhooks",
      status: "NOT_CONFIGURED",
      detail:
        "Cashfree credentials are not configured — webhook signature verification is unavailable",
    };
  }

  const last = await db.webhookEvent.findFirst({
    orderBy: { receivedAt: "desc" },
  });

  if (!last) {
    return {
      name: "Webhooks",
      status: "WARNING",
      detail:
        "Cashfree webhook verification is configured, but no webhook events have been received yet",
    };
  }

  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const recentFailureCount = await db.webhookEvent.count({
    where: {
      status: "FAILED",
      receivedAt: {
        gte: since,
      },
    },
  });

  if (last.status === "FAILED") {
    return {
      name: "Webhooks",
      status: "ERROR",
      detail: `Most recent event (${last.type}) failed processing`,
    };
  }

  if (recentFailureCount > 0) {
    return {
      name: "Webhooks",
      status: "WARNING",
      detail: `${recentFailureCount} failed event(s) in the last 24h`,
    };
  }

  const ageHours =
    (Date.now() - last.receivedAt.getTime()) / 3_600_000;

  if (ageHours > 72) {
    return {
      name: "Webhooks",
      status: "WARNING",
      detail: `Last event received ${Math.round(ageHours)}h ago — normal if there have been no recent orders`,
    };
  }

  return {
    name: "Webhooks",
    status: "HEALTHY",
    detail: `Last event: ${last.type}, ${Math.round(ageHours)}h ago`,
  };
}

// ---------------------------------------------------------------------------
// Activity / history
// ---------------------------------------------------------------------------

async function getWebhookActivity(): Promise<WebhookActivity> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const [
    last,
    lastSuccess,
    recentFailureCount,
  ] = await Promise.all([
    db.webhookEvent.findFirst({
      orderBy: { receivedAt: "desc" },
    }),
    db.webhookEvent.findFirst({
      where: { status: "PROCESSED" },
      orderBy: { processedAt: "desc" },
    }),
    db.webhookEvent.count({
      where: {
        status: "FAILED",
        receivedAt: {
          gte: since,
        },
      },
    }),
  ]);

  return {
    lastEventType: last?.type ?? null,
    lastEventStatus: last?.status ?? null,
    lastEventAt: last?.receivedAt.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.processedAt?.toISOString() ?? null,
    recentFailureCount,
  };
}

async function getStorageActivity(): Promise<StorageActivity> {
  const [
    lastSuccess,
    lastFailed,
  ] = await Promise.all([
    db.storageObject.findFirst({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
    }),
    db.storageObject.findFirst({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    lastSuccessfulUploadAt: lastSuccess?.updatedAt.toISOString() ?? null,
    lastFailedUploadAt: lastFailed?.updatedAt.toISOString() ?? null,
  };
}

async function getPaymentActivity(): Promise<PaymentActivity> {
  const [
    lastPaid,
    lastFailed,
  ] = await Promise.all([
    db.order.findFirst({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
    }),
    db.order.findFirst({
      where: { status: "FAILED" },
      orderBy: { failedAt: "desc" },
    }),
  ]);

  return {
    lastSuccessfulPaymentAt: lastPaid?.paidAt?.toISOString() ?? null,
    lastFailedPaymentAt: lastFailed?.failedAt?.toISOString() ?? null,
  };
}

/**
 * Section 6 — "recent application errors."
 * Combines the small in-memory error-event buffer with structured failures
 * already persisted for other reasons.
 */
async function getRecentOperationalErrors(): Promise<{
  items: RecentErrorItem[];
  totalRecentCount: number;
}> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const [
    systemErrors,
    webhookFailures,
    paymentFailures,
    downloadFailures,
    batchFailures,
    uploadFailures,
  ] = await Promise.all([
    Promise.resolve(getRecentErrorEvents()),
    db.webhookEvent.findMany({
      where: {
        status: "FAILED",
        receivedAt: {
          gte: since,
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }),
    db.order.findMany({
      where: {
        status: "FAILED",
        failedAt: {
          gte: since,
        },
      },
      orderBy: { failedAt: "desc" },
      take: 5,
    }),
    db.downloadLog.findMany({
      where: {
        success: false,
        createdAt: {
          gte: since,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.batchDownloadJob.findMany({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: since,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.storageObject.findMany({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: since,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const items: RecentErrorItem[] = [
    ...systemErrors.map((e) => ({
      source: "system" as const,
      message: e.event,
      at: e.ts,
    })),

    ...webhookFailures.map((w) => ({
      source: "webhook" as const,
      message: `Webhook processing failed: ${w.type}${
        w.error ? ` — ${truncate(w.error)}` : ""
      }`,
      at: w.receivedAt.toISOString(),
    })),

    ...paymentFailures.map((o) => ({
      source: "payment" as const,
      message: `Payment failed${
        o.failureReason ? `: ${truncate(o.failureReason)}` : ""
      }`,
      at: (o.failedAt ?? o.createdAt).toISOString(),
    })),

    ...downloadFailures.map((d) => ({
      source: "download" as const,
      message: `Download failed${
        d.reason ? `: ${truncate(d.reason)}` : ""
      }`,
      at: d.createdAt.toISOString(),
    })),

    ...batchFailures.map((b) => ({
      source: "batch" as const,
      message: `Batch ZIP generation failed${
        b.error ? `: ${truncate(b.error)}` : ""
      }`,
      at: b.updatedAt.toISOString(),
    })),

    ...uploadFailures.map((s) => ({
      source: "upload" as const,
      message: `Upload verification failed for ${s.key}`,
      at: s.updatedAt.toISOString(),
    })),
  ];

  items.sort(
    (a, b) =>
      new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  const totalRecentCount =
    systemErrors.length +
    webhookFailures.length +
    paymentFailures.length +
    downloadFailures.length +
    batchFailures.length +
    uploadFailures.length;

  return {
    items: items.slice(0, 10),
    totalRecentCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Keeps error detail shown in the admin UI short and free of anything that
 * could contain credentials.
 */
function sanitizeError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : String(err);

  return truncate(message, 200);
}

function truncate(value: string, max = 140): string {
  return value.length > max
    ? `${value.slice(0, max)}…`
    : value;
}