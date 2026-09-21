import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { verifyPaymentSchema } from "@/lib/validation";
import { getPaymentStatus } from "@/server/services/order.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);

    const limit = rateLimit(
      `payment-status:${user.id}:${ip}`,
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

    const result = await getPaymentStatus({
      userId: user.id,
      orderId: body.orderId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return apiError(err);
  }
}