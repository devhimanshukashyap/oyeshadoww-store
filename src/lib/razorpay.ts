import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * All Razorpay secret operations happen here, server-side only. The
 * RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET never touch the browser.
 * Only RAZORPAY_KEY_ID (via NEXT_PUBLIC_RAZORPAY_KEY_ID) is public — that's
 * expected and safe; it identifies the merchant account, it does not
 * authorize anything by itself.
 */

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (instance) return instance;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. See docs/DEPLOYMENT.md."
    );
  }
  instance = new Razorpay({ key_id, key_secret });
  return instance;
}

/** Creates a Razorpay order for an amount the SERVER computed — never a client-supplied amount. */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const rzp = getRazorpay();
  return rzp.orders.create({
    amount: params.amountPaise,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes,
  });
}

/**
 * Verifies the signature returned to the browser after checkout
 * (razorpay_order_id|razorpay_payment_id signed with the key secret).
 * This confirms the payment response genuinely came from Razorpay and
 * wasn't spoofed by client-side JavaScript claiming "payment successful."
 *
 * IMPORTANT: this check alone is not sufficient to grant access — see
 * lib fulfillOrder() which additionally re-checks payment status via the
 * webhook/API and uses a DB transaction to avoid double-fulfillment.
 */
export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = requireWebhooklessSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, params.signature);
}

/** Verifies the `X-Razorpay-Signature` header on incoming webhooks. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured. See docs/DEPLOYMENT.md.");
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, signatureHeader);
}

function requireWebhooklessSecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  return secret;
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Server-side lookup of a payment's actual status directly from Razorpay's API, used as a defense-in-depth double-check alongside signature verification. */
export async function fetchRazorpayPayment(paymentId: string) {
  const rzp = getRazorpay();
  return rzp.payments.fetch(paymentId);
}
