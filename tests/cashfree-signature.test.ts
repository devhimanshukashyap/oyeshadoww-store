import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

beforeAll(() => {
  process.env.CASHFREE_SECRET_KEY = "test_webhook_secret";
  process.env.CASHFREE_APP_ID = "test_app_id";
  process.env.CASHFREE_ENVIRONMENT = "sandbox";
});

function createSignature(
  rawBody: string,
  timestamp: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
}

describe("verifyCashfreeWebhookSignature", () => {
  it("accepts a correctly signed webhook body", async () => {
    const { verifyCashfreeWebhookSignature } = await import("@/lib/cashfree");

    const body = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: {
          order_id: "order_ABC123",
        },
      },
    });

    const timestamp = "1758192000000";

    const signature = createSignature(
      body,
      timestamp,
      "test_webhook_secret"
    );

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: body,
        timestamp,
        signature,
      })
    ).toBe(true);
  });

  it("rejects a tampered webhook body", async () => {
    const { verifyCashfreeWebhookSignature } = await import("@/lib/cashfree");

    const originalBody = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      amount: 100,
    });

    const timestamp = "1758192000000";

    const signature = createSignature(
      originalBody,
      timestamp,
      "test_webhook_secret"
    );

    const tamperedBody = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      amount: 999999,
    });

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: tamperedBody,
        timestamp,
        signature,
      })
    ).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const { verifyCashfreeWebhookSignature } = await import("@/lib/cashfree");

    const body = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
    });

    const timestamp = "1758192000000";

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: body,
        timestamp,
        signature: "invalid_signature",
      })
    ).toBe(false);
  });

  it("rejects when the signature is missing", async () => {
    const { verifyCashfreeWebhookSignature } = await import("@/lib/cashfree");

    const body = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
    });

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: body,
        timestamp: "1758192000000",
        signature: "",
      })
    ).toBe(false);
  });

  it("rejects when the timestamp is missing", async () => {
    const { verifyCashfreeWebhookSignature } = await import("@/lib/cashfree");

    const body = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
    });

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: body,
      timestamp: "",
        signature: "some_signature",
      })
    ).toBe(false);
  });
});