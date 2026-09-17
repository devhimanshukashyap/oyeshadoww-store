import { describe, it, expect } from "vitest";
import { createOrderSchema, batchDownloadCreateSchema } from "@/lib/validation";

describe("createOrderSchema", () => {
  it("accepts a valid productId + variant", () => {
    const result = createOrderSchema.safeParse({ productId: "prod_1", variant: "CLEAN" });
    expect(result.success).toBe(true);
  });

  it("strips any client-supplied price/amount field — the schema has no such field at all", () => {
    // This is the actual guarantee: even if a malicious client sends an
    // "amount" or "price" field trying to override the server-computed
    // price, the parsed object simply never has one for the order service
    // to (mis)use — see order.service.ts createPendingOrder().
    const result = createOrderSchema.safeParse({
      productId: "prod_1",
      variant: "CLEAN",
      amountPaise: 1, // attempted price tampering
      price: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ productId: "prod_1", variant: "CLEAN" });
      expect((result.data as any).amountPaise).toBeUndefined();
      expect((result.data as any).price).toBeUndefined();
    }
  });

  it("rejects an invalid variant", () => {
    const result = createOrderSchema.safeParse({ productId: "prod_1", variant: "FREE" });
    expect(result.success).toBe(false);
  });
});

describe("batchDownloadCreateSchema", () => {
  it("rejects an empty reel selection", () => {
    const result = batchDownloadCreateSchema.safeParse({ productId: "prod_1", reelIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unreasonably large batch request (basic abuse guard)", () => {
    const result = batchDownloadCreateSchema.safeParse({
      productId: "prod_1",
      reelIds: Array.from({ length: 500 }, (_, i) => `reel_${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a normal batch selection", () => {
    const result = batchDownloadCreateSchema.safeParse({
      productId: "prod_1",
      reelIds: ["reel_1", "reel_2", "reel_3"],
    });
    expect(result.success).toBe(true);
  });
});
