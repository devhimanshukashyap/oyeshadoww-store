import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { fulfillOrder, markOrderFailed, refundOrder } from "@/server/services/order.service";
import { logger } from "@/lib/logger";

/**
 * Server-to-server confirmation of payment status. This is the
 * authoritative source of truth for order fulfillment — even if a
 * customer's browser never calls /api/payment/verify (closed tab, network
 * drop, malicious client skipping it entirely), the webhook still grants
 * access once Razorpay confirms the payment. Conversely if a client posts
 * a forged "payment succeeded" request without a valid webhook ever
 * arriving, the order simply never reaches PAID.
 *
 * Idempotency: every event is written to WebhookEvent keyed by a unique
 * event id BEFORE any side effect runs. If Razorpay redelivers the same
 * event (which their docs say to expect and handle), the unique
 * constraint on eventId makes the second insert fail harmlessly and we
 * skip reprocessing.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    logger.error("webhook.config_error", { error: String(err) });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!signatureValid) {
    logger.warn("webhook.invalid_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = payload.event ?? "unknown";
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  // Prefer Razorpay's own delivery id header if present; otherwise derive
  // a stable key from the event type + the underlying entity id so
  // redeliveries of the same logical event collide on the same row.
  const headerEventId = req.headers.get("x-razorpay-event-id");
  const derivedId =
    paymentEntity?.id ?? refundEntity?.id ?? orderEntity?.id ?? `${eventType}:${Date.now()}`;
  const eventId = headerEventId ?? `${eventType}:${derivedId}`;

  let eventRow;
  try {
    eventRow = await db.webhookEvent.create({
      data: { eventId, type: eventType, payload, status: "RECEIVED" },
    });
  } catch {
    // Unique constraint violation => we've already seen and (presumably)
    // processed this event. Acknowledge with 200 so Razorpay stops retrying.
    logger.info("webhook.duplicate_ignored", { eventId, eventType });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (eventType) {
      case "payment.captured":
      case "payment.authorized": {
        const razorpayOrderId = paymentEntity?.order_id;
        const razorpayPaymentId = paymentEntity?.id;
        if (razorpayOrderId && razorpayPaymentId) {
          const order = await db.order.findUnique({ where: { razorpayOrderId } });
          if (order) {
            await fulfillOrder({ orderId: order.id, razorpayPaymentId });
          } else {
            logger.warn("webhook.order_not_found", { razorpayOrderId, eventType });
          }
        }
        break;
      }

      case "payment.failed": {
        const razorpayOrderId = paymentEntity?.order_id;
        if (razorpayOrderId) {
          const order = await db.order.findUnique({ where: { razorpayOrderId } });
          if (order) {
            await markOrderFailed(order.id, paymentEntity?.error_description ?? "Payment failed");
          }
        }
        break;
      }

      case "refund.processed": {
        const razorpayPaymentId = refundEntity?.payment_id;
        if (razorpayPaymentId) {
          const order = await db.order.findUnique({ where: { razorpayPaymentId } });
          if (order && order.status === "PAID") {
            await refundOrder(order.id);
          }
        }
        break;
      }

      default:
        logger.info("webhook.unhandled_event", { eventType });
    }

    await db.webhookEvent.update({
      where: { id: eventRow.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    logger.error("webhook.processing_failed", { eventId, error: String(err) });
    await db.webhookEvent.update({
      where: { id: eventRow.id },
      data: { status: "FAILED", error: String(err) },
    });
    // Still return 200: we've durably recorded the event and can
    // reprocess it manually/via a retry job. Returning 500 would just
    // cause Razorpay to hammer retries for a bug that needs a code fix.
  }

  return NextResponse.json({ ok: true });
}
