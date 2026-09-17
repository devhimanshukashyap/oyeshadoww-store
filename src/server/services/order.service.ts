import { db } from "@/lib/db";
import { createRazorpayOrder, fetchRazorpayPayment, verifyCheckoutSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { sendEmail, purchaseConfirmationEmail, paymentFailedEmail, refundConfirmationEmail } from "@/lib/email";
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
 * Step 1 of checkout: create a pending Order + a Razorpay order for the
 * ACTUAL price of the product, read fresh from the database. The
 * variant/productId the browser sends only selects *which* price to look
 * up — the amount itself is never taken from the request body. This is
 * what makes client-side price tampering impossible: the worst a
 * malicious client can do is ask to buy a product that doesn't exist or
 * isn't purchasable, which is rejected below.
 */
export async function createPendingOrder(params: { userId: string; productId: string; variant: Variant }) {
  const product = await db.product.findFirst({
    where: { id: params.productId, deletedAt: null },
  });

  if (!product) throw new OrderError("Product not found", 404);
  if (product.status !== "PUBLISHED" || !product.purchasable) {
    throw new OrderError("This product is not currently available for purchase", 409);
  }

  const unitPricePaise =
    params.variant === "WATERMARKED" ? product.watermarkedPriceInPaise : product.cleanPriceInPaise;

  if (unitPricePaise == null) {
    throw new OrderError("This product variant is not available", 409);
  }

  // Prevent buying something you already own (avoid duplicate entitlement noise).
  const existing = await db.purchase.findUnique({
    where: {
      userId_productId_variant: { userId: params.userId, productId: product.id, variant: params.variant },
    },
  });
  if (existing && existing.status === "ACTIVE") {
    throw new OrderError("You already own this product", 409);
  }

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
    include: { items: true },
  });

  const rzpOrder = await createRazorpayOrder({
    amountPaise: unitPricePaise,
    currency: product.currency,
    receipt: order.id,
    notes: { orderId: order.id, productId: product.id, variant: params.variant },
  });

  await db.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: rzpOrder.id, status: "PENDING" },
  });

  logger.info("order.created", { orderId: order.id, productId: product.id, variant: params.variant });

  return {
    orderId: order.id,
    razorpayOrderId: rzpOrder.id,
    amountPaise: unitPricePaise,
    currency: product.currency,
    productName: product.name,
  };
}

/**
 * Step 2: called from the client's Razorpay success handler. Verifies the
 * HMAC signature, then double-checks the payment's real status directly
 * against Razorpay's API (defense in depth — never trust the browser
 * alone), then fulfills the order. Fulfillment is also independently
 * triggered by the webhook (see webhook route) — fulfillOrder() is
 * idempotent so whichever path arrives first wins and the other is a
 * harmless no-op.
 */
export async function verifyAndFulfillOrder(params: {
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const order = await db.order.findUnique({
    where: { razorpayOrderId: params.razorpayOrderId },
    include: { items: true },
  });
  if (!order) throw new OrderError("Order not found", 404);
  if (order.userId !== params.userId) throw new OrderError("Not your order", 403);

  const signatureValid = verifyCheckoutSignature({
    orderId: params.razorpayOrderId,
    paymentId: params.razorpayPaymentId,
    signature: params.razorpaySignature,
  });

  if (!signatureValid) {
    logger.warn("order.signature_invalid", { orderId: order.id });
    await markOrderFailed(order.id, "Invalid payment signature");
    throw new OrderError("Payment verification failed", 400);
  }

  // Defense in depth: re-fetch the payment from Razorpay's servers and
  // confirm it is actually captured/authorized for the expected amount,
  // rather than trusting the signature alone.
  const payment = await fetchRazorpayPayment(params.razorpayPaymentId);
  const paymentOk =
    (payment.status === "captured" || payment.status === "authorized") &&
    Number(payment.amount) === order.totalAmountPaise &&
    payment.order_id === params.razorpayOrderId;

  if (!paymentOk) {
    logger.warn("order.payment_mismatch", { orderId: order.id, paymentStatus: payment.status });
    await markOrderFailed(order.id, "Payment status/amount mismatch");
    throw new OrderError("Payment could not be verified", 400);
  }

  await fulfillOrder({
    orderId: order.id,
    razorpayPaymentId: params.razorpayPaymentId,
    razorpaySignature: params.razorpaySignature,
  });

  return { orderId: order.id };
}

/**
 * Idempotent fulfillment: marks the order PAID and grants Purchase rows in
 * a single DB transaction, guarded so it can safely run twice (once from
 * the client verify call, once from the webhook) without creating
 * duplicate purchases or double-counting revenue.
 */
export async function fulfillOrder(params: {
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: params.orderId }, include: { items: true } });
    if (!order) throw new OrderError("Order not found", 404);

    if (order.status === "PAID") {
      // Already fulfilled by the other path (webhook vs. client verify race).
      return { order, alreadyProcessed: true };
    }

    if (order.status === "REFUNDED" || order.status === "CANCELLED") {
      // Don't resurrect a terminal order.
      return { order, alreadyProcessed: true };
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySignature: params.razorpaySignature,
      },
    });

    for (const item of order.items) {
      await tx.purchase.upsert({
        where: {
          userId_productId_variant: {
            userId: order.userId,
            productId: item.productId,
            variant: item.variant,
          },
        },
        update: { status: "ACTIVE", revokedAt: null, orderId: order.id },
        create: {
          userId: order.userId,
          productId: item.productId,
          orderId: order.id,
          variant: item.variant,
          status: "ACTIVE",
        },
      });
    }

    return { order: updatedOrder, alreadyProcessed: false };
  });

  if (!result.alreadyProcessed) {
    logger.info("order.fulfilled", { orderId: result.order.id });
    await sendPurchaseConfirmation(result.order.id).catch((err) =>
      logger.error("order.confirmation_email_failed", { orderId: result.order.id, error: String(err) })
    );
  }

  return result;
}

export async function markOrderFailed(orderId: string, reason: string) {
  await db.order.updateMany({
    where: { id: orderId, status: { in: ["CREATED", "PENDING"] } },
    data: { status: "FAILED", failedAt: new Date(), failureReason: reason },
  });
  logger.warn("order.failed", { orderId, reason });

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (order) {
    const settings = await getSettings();
    const email = paymentFailedEmail({
      customerName: order.user.name ?? "there",
      productName: order.items[0]?.productNameSnapshot ?? "your order",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    });
    await sendEmail({ to: order.user.email, ...email }).catch(() => {});
    void settings;
  }
}

async function sendPurchaseConfirmation(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) return;
  const item = order.items[0];
  const email = purchaseConfirmationEmail({
    customerName: order.user.name ?? "there",
    productName: item?.productNameSnapshot ?? "your bundle",
    variant: item?.variant === "CLEAN" ? "Non-watermarked" : "Watermarked",
    amountDisplay: `₹${(order.totalAmountPaise / 100).toFixed(2)}`,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  });
  await sendEmail({ to: order.user.email, ...email });
}

/** Revokes entitlements tied to a refunded order and updates its status. Historical order/purchase rows are kept, never deleted. */
export async function refundOrder(orderId: string) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED", refundedAt: new Date() },
      include: { items: true, user: true },
    });

    await tx.purchase.updateMany({
      where: { orderId: order.id },
      data: { status: "REFUNDED", revokedAt: new Date() },
    });

    return order;
  });

  logger.info("order.refunded", { orderId });

  const item = result.items[0];
  await sendEmail({
    to: result.user.email,
    ...refundConfirmationEmail({
      customerName: result.user.name ?? "there",
      productName: item?.productNameSnapshot ?? "your order",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    }),
  }).catch(() => {});

  return result;
}
