import { db } from "@/lib/db";
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreePayments,
} from "@/lib/cashfree";
import { logger } from "@/lib/logger";
import {
  sendEmail,
  purchaseConfirmationEmail,
  paymentFailedEmail,
  refundConfirmationEmail,
} from "@/lib/email";
import { getSettings } from "@/lib/settings";
import type { Variant } from "@prisma/client";

export class OrderError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Step 1 of checkout:
 * Create our local Order first, then create the corresponding Cashfree order.
 *
 * The amount is ALWAYS read from the database.
 * The browser only tells us which product + variant it wants to purchase.
 *
 * Cashfree receives:
 * - our internal order.id as Cashfree order_id
 * - the server-authoritative amount
 * - the authenticated customer's details
 * - a return URL
 * - our webhook URL
 */
export async function createPendingOrder(params: {
  userId: string;
  productId: string;
  variant: Variant;
}) {
  // Fetch the authenticated customer server-side.
  const user = await db.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new OrderError("User not found", 404);
  }

  // Cashfree requires customer phone details for this checkout flow.
  if (!user.phone) {
    throw new OrderError(
      "Please add your mobile number before making a payment",
      400,
    );
  }

  const product = await db.product.findFirst({
    where: {
      id: params.productId,
      deletedAt: null,
    },
  });

  if (!product) {
    throw new OrderError("Product not found", 404);
  }

  if (product.status !== "PUBLISHED" || !product.purchasable) {
    throw new OrderError(
      "This product is not currently available for purchase",
      409,
    );
  }

  // IMPORTANT:
  // Never trust the amount from the browser.
  const unitPricePaise =
    params.variant === "WATERMARKED"
      ? product.watermarkedPriceInPaise
      : product.cleanPriceInPaise;

  if (unitPricePaise == null) {
    throw new OrderError(
      "This product variant is not available",
      409,
    );
  }

  // Prevent buying something the customer already owns.
  const existing = await db.purchase.findUnique({
    where: {
      userId_productId_variant: {
        userId: params.userId,
        productId: product.id,
        variant: params.variant,
      },
    },
  });

  if (existing && existing.status === "ACTIVE") {
    throw new OrderError(
      "You already own this product",
      409,
    );
  }

  // Create our internal order first.
  const order = await db.order.create({
    data: {
      userId: params.userId,
      status: "CREATED",
      currency: product.currency,
      totalAmountPaise: unitPricePaise,

      items: {
        create: [
          {
            productId: product.id,
            variant: params.variant,
            unitPricePaise,
            productNameSnapshot: product.name,
          },
        ],
      },
    },

    include: {
      items: true,
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not configured",
    );
  }

  // Create the corresponding Cashfree order.
  //
  // Our internal order.id is used as the Cashfree order_id.
  // This gives us a simple 1:1 mapping for webhook/status handling.
  const cashfreeOrder = await createCashfreeOrder({
    orderId: order.id,
    amountPaise: unitPricePaise,
    currency: product.currency,

    customerId: user.id,
    customerName: user.name ?? "Customer",
    customerEmail: user.email,
    customerPhone: user.phone,

    returnUrl:
      `${siteUrl}/order/success?orderId=${encodeURIComponent(order.id)}`,

    notifyUrl:
      `${siteUrl}/api/webhooks/cashfree`,
  });

  // Store Cashfree's identifiers.
  await db.order.update({
    where: {
      id: order.id,
    },

    data: {
      cashfreeOrderId: cashfreeOrder.order_id,
      status: "PENDING",
    },
  });

  logger.info("order.created", {
    orderId: order.id,
    productId: product.id,
    variant: params.variant,
    paymentProvider: "cashfree",
  });

  return {
    orderId: order.id,
    paymentSessionId: cashfreeOrder.payment_session_id,
    amountPaise: unitPricePaise,
    currency: product.currency,
    productName: product.name,
  };
}

/**
 * Step 2:
 * Called after the customer returns from Cashfree checkout.
 *
 * We DO NOT trust the browser to tell us whether payment succeeded.
 * We query Cashfree's API and verify:
 *
 * 1. Correct order
 * 2. Correct amount
 * 3. Correct currency
 * 4. Cashfree order status is PAID
 * 5. At least one successful payment exists
 * 6. Payment amount matches our order
 *
 * Only then do we grant the Purchase entitlement.
 *
 * The webhook also calls fulfillOrder(), so either path can safely
 * complete the purchase. fulfillOrder() is idempotent.
 */

export async function getPaymentStatus(params: {
  userId: string;
  orderId: string;
}) {
  const order = await db.order.findUnique({
    where: {
      id: params.orderId,
    },
  });

  if (!order) {
    throw new OrderError("Order not found", 404);
  }

  if (order.userId !== params.userId) {
    throw new OrderError("Not your order", 403);
  }

  if (!order.cashfreeOrderId) {
    throw new OrderError("Payment order not found", 400);
  }

  const cashfreeOrder = await fetchCashfreeOrder(
    order.cashfreeOrderId,
  );

  const orderMatches =
    cashfreeOrder.order_id === order.cashfreeOrderId &&
    Number(cashfreeOrder.order_amount) ===
    order.totalAmountPaise / 100 &&
    cashfreeOrder.order_currency === order.currency;

  if (!orderMatches) {
    logger.warn("order.payment_status_mismatch", {
      orderId: order.id,
      cashfreeOrderId: order.cashfreeOrderId,
      cashfreeStatus: cashfreeOrder.order_status,
    });

    return {
      orderId: order.id,
      status: "FAILED" as const,
      reason: "Payment verification failed",
    };
  }

  const cashfreeStatus = cashfreeOrder.order_status;

  if (cashfreeStatus === "PAID") {
    try {
      await verifyAndFulfillOrder({
        userId: params.userId,
        orderId: params.orderId,
      });

      return {
        orderId: order.id,
        status: "PAID" as const,
      };
    } catch (err) {
      logger.info("order.payment_verification_pending", {
        orderId: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
        cashfreeStatus,
      });

      return {
        orderId: order.id,
        status: "PENDING" as const,
      };
    }
  }

  const payments = await fetchCashfreePayments(
    order.cashfreeOrderId,
  );

  const failedPayment = payments.some(
    (payment) =>
      payment.order_id === order.cashfreeOrderId &&
      [
        "FAILED",
        "USER_DROPPED",
        "CANCELLED",
      ].includes(payment.payment_status),
  );

  if (
    cashfreeStatus === "EXPIRED" ||
    cashfreeStatus === "CANCELLED" ||
    failedPayment
  ) {
    return {
      orderId: order.id,
      status: "FAILED" as const,
      reason: failedPayment
        ? "cancelled"
        : cashfreeStatus,
    };
  }

  return {
    orderId: order.id,
    status: "PENDING" as const,
    cashfreeStatus,
  };
}

export async function verifyAndFulfillOrder(params: {
  userId: string;
  orderId: string;
}) {
  const order = await db.order.findUnique({
    where: {
      id: params.orderId,
    },

    include: {
      items: true,
    },
  });

  if (!order) {
    throw new OrderError("Order not found", 404);
  }

  if (order.userId !== params.userId) {
    throw new OrderError("Not your order", 403);
  }

  if (!order.cashfreeOrderId) {
    throw new OrderError("Payment order not found", 400);
  }

  const cashfreeOrderId = order.cashfreeOrderId;

  // Get the authoritative order status from Cashfree.
  const cashfreeOrder =
    await fetchCashfreeOrder(cashfreeOrderId);

  // Verify the order identity, amount and currency.
  const orderMatches =
    cashfreeOrder.order_id === cashfreeOrderId &&
    Number(cashfreeOrder.order_amount) ===
    order.totalAmountPaise / 100 &&
    cashfreeOrder.order_currency === order.currency;

  if (!orderMatches) {
    logger.warn("order.payment_mismatch", {
      orderId: order.id,
      cashfreeOrderId,
      cashfreeStatus: cashfreeOrder.order_status,
    });

    await markOrderFailed(
      order.id,
      "Payment order amount/currency mismatch",
    );

    throw new OrderError(
      "Payment could not be verified",
      400,
    );
  }

  // Cashfree considers the order paid only when the order status is PAID.
  if (cashfreeOrder.order_status !== "PAID") {
    logger.info("order.payment_not_completed", {
      orderId: order.id,
      cashfreeOrderId,
      status: cashfreeOrder.order_status,
    });

    throw new OrderError(
      `Payment is not completed. Status: ${cashfreeOrder.order_status}`,
      400,
    );
  }

  // Fetch individual payment attempts and find a successful one.
  const payments =
    await fetchCashfreePayments(cashfreeOrderId);

  const successfulPayment = payments.find(
    (payment) =>
      payment.payment_status === "SUCCESS" &&
      payment.order_id === cashfreeOrderId &&
      Number(payment.payment_amount) ===
      order.totalAmountPaise / 100 &&
      payment.payment_currency === order.currency,
  );

  if (!successfulPayment) {
    logger.warn("order.payment_not_found", {
      orderId: order.id,
      cashfreeOrderId,
    });

    throw new OrderError(
      "Payment could not be verified",
      400,
    );
  }

  await fulfillOrder({
    orderId: order.id,
    cashfreePaymentId: String(
      successfulPayment.cf_payment_id,
    ),
  });

  return {
    orderId: order.id,
  };
}

/**
 * Idempotent fulfillment:
 *
 * Marks the order PAID and grants the Purchase entitlement
 * inside one DB transaction.
 *
 * This function can safely be called by:
 * - customer return/status verification
 * - Cashfree webhook
 *
 * If both happen, the second call becomes a harmless no-op.
 */
export async function fulfillOrder(params: {
  orderId: string;
  cashfreePaymentId: string;
}) {
  const result = await db.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: params.orderId,
        },

        include: {
          items: true,
        },
      });

      if (!order) {
        throw new OrderError(
          "Order not found",
          404,
        );
      }

      // Already fulfilled.
      if (order.status === "PAID") {
        return {
          order,
          alreadyProcessed: true,
        };
      }

      // Never resurrect a terminal order.
      if (
        order.status === "REFUNDED" ||
        order.status === "CANCELLED"
      ) {
        return {
          order,
          alreadyProcessed: true,
        };
      }

      const updatedOrder =
        await tx.order.update({
          where: {
            id: order.id,
          },

          data: {
            status: "PAID",
            paidAt: new Date(),
            cashfreePaymentId:
              params.cashfreePaymentId,
          },
        });

      // Grant the actual download entitlement.
      for (const item of order.items) {
        await tx.purchase.upsert({
          where: {
            userId_productId_variant: {
              userId: order.userId,
              productId: item.productId,
              variant: item.variant,
            },
          },

          update: {
            status: "ACTIVE",
            revokedAt: null,
            orderId: order.id,
          },

          create: {
            userId: order.userId,
            productId: item.productId,
            orderId: order.id,
            variant: item.variant,
            status: "ACTIVE",
          },
        });
      }

      return {
        order: updatedOrder,
        alreadyProcessed: false,
      };
    },
  );

  if (!result.alreadyProcessed) {
    logger.info("order.fulfilled", {
      orderId: result.order.id,
      paymentProvider: "cashfree",
    });

    await sendPurchaseConfirmation(
      result.order.id,
    ).catch((err) =>
      logger.error(
        "order.confirmation_email_failed",
        {
          orderId: result.order.id,
          error: String(err),
        },
      ),
    );
  }

  return result;
}

export async function markOrderFailed(
  orderId: string,
  reason: string,
) {
  await db.order.updateMany({
    where: {
      id: orderId,
      status: {
        in: ["CREATED", "PENDING"],
      },
    },

    data: {
      status: "FAILED",
      failedAt: new Date(),
      failureReason: reason,
    },
  });

  logger.warn("order.failed", {
    orderId,
    reason,
  });

  const order = await db.order.findUnique({
    where: {
      id: orderId,
    },

    include: {
      user: true,
      items: true,
    },
  });

  if (order) {
    const settings = await getSettings();

    const email = paymentFailedEmail({
      customerName:
        order.user.name ?? "there",

      productName:
        order.items[0]?.productNameSnapshot ??
        "your order",

      siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ?? "",
    });

    await sendEmail({
      to: order.user.email,
      ...email,
    }).catch(() => { });

    void settings;
  }
}

async function sendPurchaseConfirmation(
  orderId: string,
) {
  const order = await db.order.findUnique({
    where: {
      id: orderId,
    },

    include: {
      user: true,
      items: true,
    },
  });

  if (!order) return;

  const item = order.items[0];

  const email = purchaseConfirmationEmail({
    customerName:
      order.user.name ?? "there",

    productName:
      item?.productNameSnapshot ??
      "your bundle",

    variant:
      item?.variant === "CLEAN"
        ? "Non-watermarked"
        : "Watermarked",

    amountDisplay:
      `₹${(order.totalAmountPaise / 100).toFixed(2)}`,

    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL ?? "",
  });

  await sendEmail({
    to: order.user.email,
    ...email,
  });
}

/**
 * Revokes entitlements tied to a refunded order
 * and updates its status.
 *
 * Historical order/purchase rows are kept.
 */
export async function refundOrder(
  orderId: string,
) {
  const result = await db.$transaction(
    async (tx) => {
      const order = await tx.order.update({
        where: {
          id: orderId,
        },

        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
        },

        include: {
          items: true,
          user: true,
        },
      });

      await tx.purchase.updateMany({
        where: {
          orderId: order.id,
        },

        data: {
          status: "REFUNDED",
          revokedAt: new Date(),
        },
      });

      return order;
    },
  );

  logger.info("order.refunded", {
    orderId,
    paymentProvider: "cashfree",
  });

  const item = result.items[0];

  await sendEmail({
    to: result.user.email,

    ...refundConfirmationEmail({
      customerName:
        result.user.name ?? "there",

      productName:
        item?.productNameSnapshot ??
        "your order",

      siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ?? "",
    }),
  }).catch(() => { });

  return result;
}