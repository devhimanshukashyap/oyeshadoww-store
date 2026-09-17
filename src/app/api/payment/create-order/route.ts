import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { createOrderSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { createPendingOrder } from "@/server/services/order.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(`create-order:${user.id}:${ip}`, 20, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const body = createOrderSchema.parse(await req.json());

    // NOTE: body only carries WHICH product/variant, never a price. The
    // actual amount charged is looked up from the database inside
    // createPendingOrder() — see order.service.ts.
    const result = await createPendingOrder({
      userId: user.id,
      productId: body.productId,
      variant: body.variant,
    });

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
