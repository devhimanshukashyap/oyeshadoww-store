import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

// Set env before importing the module under test, since it reads
// process.env at call time inside the functions (not at import time).
beforeAll(() => {
  process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
});

describe("verifyCheckoutSignature", () => {
  it("accepts a correctly signed order/payment pair", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = crypto
      .createHmac("sha256", "test_key_secret")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects a forged signature (simulating a spoofed 'payment successful' request)", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const result = verifyCheckoutSignature({
      orderId: "order_ABC123",
      paymentId: "pay_XYZ789",
      signature: "0".repeat(64), // attacker-guessed / malformed signature
    });
    expect(result).toBe(false);
  });

  it("rejects a signature computed for a different order id (payment/order mismatch)", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const signature = crypto
      .createHmac("sha256", "test_key_secret")
      .update("order_OTHER|pay_XYZ789")
      .digest("hex");

    const result = verifyCheckoutSignature({
      orderId: "order_ABC123",
      paymentId: "pay_XYZ789",
      signature,
    });
    expect(result).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed webhook body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/razorpay");
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update(body).digest("hex");

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a tampered body even with a signature from a previous valid request", async () => {
    const { verifyWebhookSignature } = await import("@/lib/razorpay");
    const originalBody = JSON.stringify({ event: "payment.captured", amount: 100 });
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update(originalBody).digest("hex");

    const tamperedBody = JSON.stringify({ event: "payment.captured", amount: 999999 });
    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects when no signature header is present", async () => {
    const { verifyWebhookSignature } = await import("@/lib/razorpay");
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });
});
