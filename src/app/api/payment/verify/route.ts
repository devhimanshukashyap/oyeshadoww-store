import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { verifyPaymentSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { verifyAndFulfillOrder } from "@/server/services/order.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Called by the browser after Cashfree Checkout completes.
 *
 * The browser only sends our internal orderId.
 * Payment verification happens server-side by querying Cashfree.
 *
 * The Cashfree webhook is the second independent fulfillment path.
 * fulfillOrder() is idempotent, so both paths can safely run.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(
      `verify:${user.id}:${ip}`,
      30,
      600,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many attempts. Try again shortly.",
        },
        { status: 429 },
      );
    }

    const body = verifyPaymentSchema.parse(
      await req.json(),
    );

    const result = await verifyAndFulfillOrder({
      userId: user.id,
      orderId: body.orderId,
    });

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
    });
  } catch (err) {
    return apiError(err);
  }
}