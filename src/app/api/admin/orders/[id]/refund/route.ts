import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { refundOrder } from "@/server/services/order.service";
import { logAdminAction } from "@/server/services/audit.service";
import { getRazorpay } from "@/lib/razorpay";
import { logger } from "@/lib/logger";

/**
 * Triggers a refund. If the order has a captured Razorpay payment, we ask
 * Razorpay to actually refund the money first; only once that succeeds do
 * we revoke the customer's entitlement in our own database. This avoids a
 * state where we've revoked access but the customer was never actually
 * refunded. If Razorpay's refund.processed webhook arrives later too,
 * refundOrder() is safe to run twice (order is already REFUNDED, so the
 * DB update is a no-op — see order.service.ts).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();

    const order = await db.order.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Only paid orders can be refunded." }, { status: 409 });
    }

    if (order.razorpayPaymentId) {
      try {
        const rzp = getRazorpay();
        await rzp.payments.refund(order.razorpayPaymentId, { amount: order.totalAmountPaise });
      } catch (err) {
        logger.error("admin.refund_api_failed", { orderId: order.id, error: String(err) });
        return NextResponse.json(
          { error: "Razorpay refund request failed. No changes were made." },
          { status: 502 }
        );
      }
    }

    const refunded = await refundOrder(order.id);

    await logAdminAction({
      adminId: admin.id,
      action: "order.refund",
      targetType: "Order",
      targetId: order.id,
    });

    return NextResponse.json({ order: refunded });
  } catch (err) {
    return apiError(err);
  }
}
