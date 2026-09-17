import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { verifyPaymentSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { verifyAndFulfillOrder } from "@/server/services/order.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Called by the browser immediately after Razorpay Checkout succeeds.
 * This is only ONE of two independent fulfillment paths — the Razorpay
 * webhook (api/webhooks/razorpay) is the authoritative, server-to-server
 * confirmation and will fulfill the order even if the customer closes
 * their browser tab right after paying. fulfillOrder() is idempotent so
 * both paths can safely run.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(`verify:${user.id}:${ip}`, 30, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const body = verifyPaymentSchema.parse(await req.json());

    const result = await verifyAndFulfillOrder({
      userId: user.id,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
    });

    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    return apiError(err);
  }
}
