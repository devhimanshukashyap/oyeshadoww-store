import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const order = { findUnique: vi.fn(), update: vi.fn() };
  const purchase = { upsert: vi.fn() };
  const tx = { order, purchase };
  return {
    db: {
      order,
      purchase,
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    },
  };
});

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  purchaseConfirmationEmail: vi.fn(() => ({ subject: "", html: "" })),
  paymentFailedEmail: vi.fn(() => ({ subject: "", html: "" })),
  refundConfirmationEmail: vi.fn(() => ({ subject: "", html: "" })),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(async () => ({})),
}));

import { db } from "@/lib/db";
import { fulfillOrder } from "@/server/services/order.service";

const mockDb = db as any;

const baseOrder = {
  id: "order_1",
  userId: "user_1",
  status: "PENDING",
  items: [{ productId: "product_1", variant: "CLEAN" }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fulfillOrder idempotency", () => {
  it("grants a Purchase and marks the order PAID on first fulfillment", async () => {
    mockDb.order.findUnique.mockResolvedValue(baseOrder);
    mockDb.order.update.mockResolvedValue({ ...baseOrder, status: "PAID" });
    mockDb.purchase.upsert.mockResolvedValue({});

    const result = await fulfillOrder({ orderId: "order_1", razorpayPaymentId: "pay_1" });

    expect(mockDb.purchase.upsert).toHaveBeenCalledTimes(1);
    expect(result.alreadyProcessed).toBe(false);
  });

  it("is a no-op the second time it's called for the same order (simulating client-verify + webhook both firing)", async () => {
    // Simulate the order having already been marked PAID by the first call.
    mockDb.order.findUnique.mockResolvedValue({ ...baseOrder, status: "PAID" });

    const result = await fulfillOrder({ orderId: "order_1", razorpayPaymentId: "pay_1" });

    // No new Purchase upsert, no order update — this is what prevents a
    // duplicated/replayed Razorpay webhook from granting access twice or
    // corrupting revenue reporting.
    expect(mockDb.purchase.upsert).not.toHaveBeenCalled();
    expect(mockDb.order.update).not.toHaveBeenCalled();
    expect(result.alreadyProcessed).toBe(true);
  });

  it("refuses to resurrect a refunded order back to PAID", async () => {
    mockDb.order.findUnique.mockResolvedValue({ ...baseOrder, status: "REFUNDED" });

    const result = await fulfillOrder({ orderId: "order_1", razorpayPaymentId: "pay_1" });

    expect(mockDb.purchase.upsert).not.toHaveBeenCalled();
    expect(result.alreadyProcessed).toBe(true);
  });
});
