import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    webhookEvent: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    storageObject: { findFirst: vi.fn(), findMany: vi.fn() },
    order: { findFirst: vi.fn(), findMany: vi.fn() },
    downloadLog: { findMany: vi.fn() },
    batchDownloadJob: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  getRecentErrorEvents: vi.fn(() => []),
}));

import { db } from "@/lib/db";
import { getRecentErrorEvents } from "@/lib/logger";
import { getHealthSnapshot } from "@/server/services/health.service";

const mockDb = db as any;

const ORIGINAL_ENV = { ...process.env };

function resetDbMocksToEmpty() {
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mockDb.webhookEvent.findFirst.mockResolvedValue(null);
  mockDb.webhookEvent.count.mockResolvedValue(0);
  mockDb.webhookEvent.findMany.mockResolvedValue([]);
  mockDb.storageObject.findFirst.mockResolvedValue(null);
  mockDb.storageObject.findMany.mockResolvedValue([]);
  mockDb.order.findFirst.mockResolvedValue(null);
  mockDb.order.findMany.mockResolvedValue([]);
  mockDb.downloadLog.findMany.mockResolvedValue([]);
  mockDb.batchDownloadJob.findMany.mockResolvedValue([]);
  (getRecentErrorEvents as any).mockReturnValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMocksToEmpty();
  process.env = { ...ORIGINAL_ENV };
  // Start from a clean slate: no R2/Razorpay configured unless a test opts in.
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getHealthSnapshot — NOT_CONFIGURED correctness", () => {
  it("reports Storage (R2) as NOT_CONFIGURED — never HEALTHY — when credentials are absent", async () => {
    const snapshot = await getHealthSnapshot();
    const storage = snapshot.checks.find((c) => c.name === "Storage (R2)");
    expect(storage?.status).toBe("NOT_CONFIGURED");
  });

  it("reports Payments (Razorpay) as NOT_CONFIGURED — never HEALTHY — when keys are absent", async () => {
    const snapshot = await getHealthSnapshot();
    const payments = snapshot.checks.find((c) => c.name === "Payments (Razorpay)");
    expect(payments?.status).toBe("NOT_CONFIGURED");
  });

  it("reports Webhooks as NOT_CONFIGURED when RAZORPAY_WEBHOOK_SECRET is unset, even if events exist", async () => {
    // Even with a webhook event on record, an unset secret means no
    // incoming webhook could have been verified — this must not read as
    // healthy just because a row exists in the table.
    mockDb.webhookEvent.findFirst.mockResolvedValue({
      type: "payment.captured",
      status: "PROCESSED",
      receivedAt: new Date(),
      processedAt: new Date(),
    });
    const snapshot = await getHealthSnapshot();
    const webhooks = snapshot.checks.find((c) => c.name === "Webhooks");
    expect(webhooks?.status).toBe("NOT_CONFIGURED");
  });

  it("does not let NOT_CONFIGURED checks drag the overall status down to WARNING/ERROR", async () => {
    const snapshot = await getHealthSnapshot();
    // Database is mocked healthy; R2/Razorpay/Webhooks are all
    // NOT_CONFIGURED (nothing set up yet, e.g. a fresh local install).
    // Overall should read HEALTHY — "not configured" is not a failure.
    expect(snapshot.overallStatus).toBe("HEALTHY");
  });
});

describe("getHealthSnapshot — database check", () => {
  it("reports ERROR (not a silent fallback) when the database query throws", async () => {
    mockDb.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const snapshot = await getHealthSnapshot();
    const database = snapshot.checks.find((c) => c.name === "Database");
    expect(database?.status).toBe("ERROR");
    expect(database?.detail).toContain("connection refused");
  });

  it("pushes overall status to ERROR when the database is down, even though R2/Razorpay are just not configured", async () => {
    mockDb.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const snapshot = await getHealthSnapshot();
    expect(snapshot.overallStatus).toBe("ERROR");
  });
});

describe("getHealthSnapshot — application info", () => {
  it("always reports the application itself as running, with environment and uptime populated", async () => {
    const snapshot = await getHealthSnapshot();
    expect(snapshot.application.status).toBe("HEALTHY");
    expect(typeof snapshot.application.uptimeSeconds).toBe("number");
    expect(snapshot.application.environment).toBeTruthy();
  });
});

describe("getHealthSnapshot — recent operational errors", () => {
  it("combines in-memory error events with persisted failure records and sorts newest-first", async () => {
    (getRecentErrorEvents as any).mockReturnValue([
      { event: "api.unhandled_error", ts: "2026-01-01T00:00:00.000Z" },
    ]);
    mockDb.order.findMany.mockResolvedValue([
      {
        failureReason: "Payment status/amount mismatch",
        failedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const snapshot = await getHealthSnapshot();

    expect(snapshot.recentErrors.totalRecentCount).toBe(2);
    expect(snapshot.recentErrors.items[0].source).toBe("payment"); // newer than the system event
    expect(snapshot.recentErrors.items[0].message).toContain("Payment status/amount mismatch");
    expect(snapshot.recentErrors.items[1].source).toBe("system");
  });

  it("reports zero recent errors when nothing failed", async () => {
    const snapshot = await getHealthSnapshot();
    expect(snapshot.recentErrors.totalRecentCount).toBe(0);
    expect(snapshot.recentErrors.items).toEqual([]);
  });
});

describe("getHealthSnapshot — never crashes the whole page", () => {
  it("still returns a full snapshot even if one sub-check throws unexpectedly", async () => {
    mockDb.storageObject.findFirst.mockRejectedValue(new Error("unexpected failure"));
    const snapshot = await getHealthSnapshot();
    // The rest of the snapshot is still populated despite one query failing...
    expect(snapshot.application).toBeDefined();
    expect(snapshot.checks.length).toBeGreaterThan(0);
    // ...and the specific section that failed degrades to a safe,
    // clearly-empty fallback rather than propagating the exception.
    expect(snapshot.storageActivity).toEqual({ lastSuccessfulUploadAt: null, lastFailedUploadAt: null });
  });
});
