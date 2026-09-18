import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { createCashfreeRefund } from "@/lib/cashfree";
import { refundOrder } from "@/server/services/order.service";
import { logAdminAction } from "@/server/services/audit.service";
import { logger } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireAdmin();

    const order = await db.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }

    if (order.status !== "PAID") {
      return NextResponse.json(
        { error: "Only paid orders can be refunded." },
        { status: 409 },
      );
    }

    if (!order.cashfreeOrderId) {
      return NextResponse.json(
        {
          error:
            "This order does not have a Cashfree order ID. Refund cannot be processed.",
        },
        { status: 409 },
      );
    }

    const refundId = `refund_${order.id}_${Date.now()}`;

    let refund;

    try {
      refund = await createCashfreeRefund({
        orderId: order.cashfreeOrderId,
        refundId,
        refundAmountPaise: order.totalAmountPaise,
        refundNote: `Refund for order ${order.id}`,
      });
    } catch (err) {
      logger.error("admin.refund_api_failed", {
        orderId: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
        error: String(err),
      });

      return NextResponse.json(
        {
          error: "Cashfree refund request failed. No changes were made.",
        },
        { status: 502 },
      );
    }

    const refundStatus = String(refund.refund_status ?? "").toUpperCase();

    if (refundStatus !== "SUCCESS") {
      logger.warn("admin.refund_not_success", {
        orderId: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
        refundId,
        refundStatus,
      });

      return NextResponse.json(
        {
          error: `Cashfree refund was not completed. Current refund status: ${refundStatus || "UNKNOWN"}.`,
          refundStatus,
          refundId,
        },
        { status: 202 },
      );
    }

    const refunded = await refundOrder(order.id);

    await logAdminAction({
      adminId: admin.id,
      action: "order.refund",
      targetType: "Order",
      targetId: order.id,
    });

    return NextResponse.json({
      order: refunded,
      refund: {
        refundId,
        status: refundStatus,
        amountPaise: order.totalAmountPaise,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}