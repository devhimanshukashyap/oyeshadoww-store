import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyCashfreeWebhookSignature,
  fetchCashfreeOrder,
  fetchCashfreePayments,
} from "@/lib/cashfree";
import {
  fulfillOrder,
  markOrderFailed,
  refundOrder,
} from "@/server/services/order.service";
import { logger } from "@/lib/logger";

/**
 * Cashfree server-to-server webhook.
 *
 * This is an independent fulfillment path from the browser's
 * /api/payment/verify endpoint.
 *
 * The webhook is authenticated using Cashfree's signature headers
 * and the raw request body.
 *
 * fulfillOrder() is idempotent, so if the browser verification
 * and webhook both process the same payment, the purchase is
 * created only once.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signature =
    req.headers.get("x-webhook-signature");

  const timestamp =
    req.headers.get("x-webhook-timestamp");

  if (!signature || !timestamp) {
    logger.warn("cashfree.webhook.missing_signature");

    return NextResponse.json(
      { error: "Missing webhook signature" },
      { status: 400 },
    );
  }

  let signatureValid = false;

  try {
    signatureValid =
      verifyCashfreeWebhookSignature({
        signature,
        timestamp,
        rawBody,
      });
  } catch (err) {
    logger.error("cashfree.webhook.config_error", {
      error: String(err),
    });

    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  if (!signatureValid) {
    logger.warn("cashfree.webhook.invalid_signature");

    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const eventType =
    payload?.type ??
    payload?.event ??
    "unknown";

  const data = payload?.data ?? {};

  const orderId =
    data?.order?.order_id ??
    data?.order_id ??
    data?.payment?.order_id;

  const cfPaymentId =
    data?.payment?.cf_payment_id ??
    data?.cf_payment_id;

  /*
   * Cashfree may provide an event ID in the webhook payload.
   * Prefer that when available.
   *
   * If unavailable, derive a stable ID from the event + order/payment.
   */
  const eventId =
    payload?.event_id ??
    payload?.eventId ??
    req.headers.get("x-webhook-event-id") ??
    `${eventType}:${cfPaymentId ?? orderId ?? "unknown"}`;

  let eventRow;

  try {
    eventRow = await db.webhookEvent.create({
      data: {
        eventId,
        type: eventType,
        payload,
        status: "RECEIVED",
      },
    });
  } catch {
    /*
     * Unique constraint means this event was already received.
     * Acknowledge it so Cashfree does not keep retrying it.
     */
    logger.info(
      "cashfree.webhook.duplicate_ignored",
      {
        eventId,
        eventType,
      },
    );

    return NextResponse.json({
      ok: true,
      duplicate: true,
    });
  }

  try {
    if (!orderId) {
      logger.warn(
        "cashfree.webhook.order_not_found_in_payload",
        {
          eventId,
          eventType,
        },
      );
    } else {
      const order = await db.order.findUnique({
        where: {
          id: orderId,
        },
      });

      if (!order) {
        logger.warn(
          "cashfree.webhook.order_not_found",
          {
            eventId,
            eventType,
            orderId,
          },
        );
      } else {
        /*
         * For payment-related events, do not trust the webhook
         * payload alone. Fetch the order directly from Cashfree
         * and verify its actual status + amount + currency.
         */
        const cashfreeOrderId =
          order.cashfreeOrderId ?? order.id;

        const cashfreeOrder =
          await fetchCashfreeOrder(
            cashfreeOrderId,
          );

        const amountMatches =
          Number(cashfreeOrder.order_amount) ===
          order.totalAmountPaise / 100;

        const currencyMatches =
          cashfreeOrder.order_currency ===
          order.currency;

        const orderMatches =
          cashfreeOrder.order_id ===
            cashfreeOrderId &&
          amountMatches &&
          currencyMatches;

        if (!orderMatches) {
          logger.warn(
            "cashfree.webhook.payment_mismatch",
            {
              eventId,
              eventType,
              orderId,
              cashfreeOrderId,
              cashfreeStatus:
                cashfreeOrder.order_status,
            },
          );

          await markOrderFailed(
            order.id,
            "Cashfree payment order amount/currency mismatch",
          );
        } else if (
          cashfreeOrder.order_status === "PAID"
        ) {
          const payments =
            await fetchCashfreePayments(
              cashfreeOrderId,
            );

          const successfulPayment =
            payments.find(
              (payment) =>
                payment.payment_status ===
                  "SUCCESS" &&
                payment.order_id ===
                  cashfreeOrderId &&
                Number(payment.payment_amount) ===
                  order.totalAmountPaise / 100 &&
                payment.payment_currency ===
                  order.currency,
            );

          if (successfulPayment) {
            await fulfillOrder({
              orderId: order.id,
              cashfreePaymentId: String(
                successfulPayment.cf_payment_id ??
                  cfPaymentId ??
                  "unknown",
              ),
            });

            logger.info(
              "cashfree.webhook.payment_fulfilled",
              {
                eventId,
                eventType,
                orderId,
                cashfreeOrderId,
              },
            );
          } else {
            logger.warn(
              "cashfree.webhook.success_payment_not_found",
              {
                eventId,
                eventType,
                orderId,
                cashfreeOrderId,
              },
            );
          }
        } else if (
          eventType.toLowerCase().includes("failed")
        ) {
          await markOrderFailed(
            order.id,
            "Cashfree payment failed",
          );
        } else if (
          eventType.toLowerCase().includes("refund")
        ) {
          if (order.status === "PAID") {
            await refundOrder(order.id);
          }
        } else {
          logger.info(
            "cashfree.webhook.unhandled_event",
            {
              eventId,
              eventType,
              orderId,
              cashfreeStatus:
                cashfreeOrder.order_status,
            },
          );
        }
      }
    }

    await db.webhookEvent.update({
      where: {
        id: eventRow.id,
      },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error(
      "cashfree.webhook.processing_failed",
      {
        eventId,
        eventType,
        error: String(err),
      },
    );

    await db.webhookEvent.update({
      where: {
        id: eventRow.id,
      },
      data: {
        status: "FAILED",
        error: String(err),
      },
    });

    /*
     * The webhook has been durably recorded.
     * Return 200 so a temporary application error does not
     * cause uncontrolled duplicate processing.
     */
  }

  return NextResponse.json({
    ok: true,
  });
}