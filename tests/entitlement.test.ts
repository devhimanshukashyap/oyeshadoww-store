import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma singleton so entitlement logic can be tested without a
// real database. Each test wires up exactly the query results it needs.
vi.mock("@/lib/db", () => ({
  db: {
    purchase: { findUnique: vi.fn(), findMany: vi.fn() },
    reel: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { hasActiveEntitlement, resolveReelAccess } from "@/server/services/entitlement.service";

const mockDb = db as unknown as {
  purchase: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  reel: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasActiveEntitlement", () => {
  it("denies access when no purchase row exists (never bought)", async () => {
    mockDb.purchase.findUnique.mockResolvedValue(null);
    const result = await hasActiveEntitlement("user_1", "product_1", "WATERMARKED");
    expect(result).toEqual({ authorized: false, reason: "NOT_OWNED" });
  });

  it("denies access when the purchase was refunded/revoked", async () => {
    mockDb.purchase.findUnique.mockResolvedValue({
      status: "REFUNDED",
      order: { status: "PAID" },
    });
    const result = await hasActiveEntitlement("user_1", "product_1", "WATERMARKED");
    expect(result).toEqual({ authorized: false, reason: "REVOKED" });
  });

  it("denies access when the purchase is active but the order was never actually paid", async () => {
    // Guards against a client-side 'payment successful' UI state without
    // real server-side payment confirmation.
    mockDb.purchase.findUnique.mockResolvedValue({
      status: "ACTIVE",
      order: { status: "PENDING" },
    });
    const result = await hasActiveEntitlement("user_1", "product_1", "WATERMARKED");
    expect(result).toEqual({ authorized: false, reason: "ORDER_NOT_PAID" });
  });

  it("grants access only when the purchase is active AND the order is paid", async () => {
    mockDb.purchase.findUnique.mockResolvedValue({
      status: "ACTIVE",
      order: { status: "PAID" },
    });
    const result = await hasActiveEntitlement("user_1", "product_1", "WATERMARKED");
    expect(result).toEqual({ authorized: true });
  });
});

describe("resolveReelAccess", () => {
  it("denies access to a reel from a product the user never purchased", async () => {
    mockDb.reel.findFirst.mockResolvedValue({
      id: "reel_1",
      productId: "product_1",
      product: { deletedAt: null },
      watermarkedObject: { key: "k1", status: "READY" },
      cleanObject: null,
    });
    mockDb.purchase.findMany.mockResolvedValue([]); // no purchases at all

    const result = await resolveReelAccess({ userId: "user_1", reelId: "reel_1" });
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.reason).toBe("NOT_OWNED");
  });

  it("denies access when the reel/product no longer exists (soft-deleted)", async () => {
    mockDb.reel.findFirst.mockResolvedValue(null);
    const result = await resolveReelAccess({ userId: "user_1", reelId: "missing" });
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.reason).toBe("NOT_FOUND");
  });

  it("grants the clean file when the user owns the clean variant, even without requesting it explicitly", async () => {
    mockDb.reel.findFirst.mockResolvedValue({
      id: "reel_1",
      productId: "product_1",
      product: { deletedAt: null },
      watermarkedObject: { key: "wm.mp4", status: "READY" },
      cleanObject: { key: "clean.mp4", status: "READY" },
    });
    mockDb.purchase.findMany.mockResolvedValue([{ variant: "CLEAN", order: { status: "PAID" } }]);

    const result = await resolveReelAccess({ userId: "user_1", reelId: "reel_1" });
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.variant).toBe("CLEAN");
      expect(result.storageObject.key).toBe("clean.mp4");
    }
  });

  it("does not grant the clean file just because the user owns the watermarked variant", async () => {
    mockDb.reel.findFirst.mockResolvedValue({
      id: "reel_1",
      productId: "product_1",
      product: { deletedAt: null },
      watermarkedObject: { key: "wm.mp4", status: "READY" },
      cleanObject: { key: "clean.mp4", status: "READY" },
    });
    mockDb.purchase.findMany.mockResolvedValue([{ variant: "WATERMARKED", order: { status: "PAID" } }]);

    const result = await resolveReelAccess({
      userId: "user_1",
      reelId: "reel_1",
      requestedVariant: "CLEAN",
    });
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.reason).toBe("NOT_OWNED");
  });

  it("denies access when the purchase exists but the order was never paid (unpaid/pending order)", async () => {
    mockDb.reel.findFirst.mockResolvedValue({
      id: "reel_1",
      productId: "product_1",
      product: { deletedAt: null },
      watermarkedObject: { key: "wm.mp4", status: "READY" },
      cleanObject: null,
    });
    mockDb.purchase.findMany.mockResolvedValue([{ variant: "WATERMARKED", order: { status: "PENDING" } }]);

    const result = await resolveReelAccess({ userId: "user_1", reelId: "reel_1" });
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.reason).toBe("NOT_OWNED");
  });
});
