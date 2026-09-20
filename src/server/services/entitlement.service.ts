import { db } from "@/lib/db";
import type { Variant } from "@prisma/client";

/**
 * Every download path (single reel, batch ZIP) goes through this file.
 * Nothing else in the codebase is allowed to decide "yes, serve the file" —
 * that keeps the authorization logic in exactly one place, so it can be
 * audited and tested in isolation (see tests/entitlement.test.ts).
 */

export interface EntitlementResult {
  authorized: boolean;
  reason?: "NOT_AUTHENTICATED" | "NOT_OWNED" | "ORDER_NOT_PAID" | "REVOKED" | "NOT_FOUND";
}

/** Does `userId` currently hold an ACTIVE purchase of `productId` at `variant`? */
export async function hasActiveEntitlement(
  userId: string,
  productId: string,
  variant: Variant
): Promise<EntitlementResult> {
  const purchase = await db.purchase.findUnique({
    where: { userId_productId_variant: { userId, productId, variant } },
    include: { order: true },
  });

  if (!purchase) return { authorized: false, reason: "NOT_OWNED" };
  if (purchase.status !== "ACTIVE") return { authorized: false, reason: "REVOKED" };
  if (purchase.order.status !== "PAID") return { authorized: false, reason: "ORDER_NOT_PAID" };

  return { authorized: true };
}

/**
 * Resolves whether a user may download a specific reel, and at which
 * variant. A user might own BOTH the watermarked and clean variant of a
 * product (bought watermarked first, upgraded later) — in that case they
 * get the best (clean) file they're entitled to, unless a specific variant
 * is requested and owned.
 */
export async function resolveReelAccess(params: {
  userId: string;
  reelId: string;
  requestedVariant?: Variant;
}) {
  const reel = await db.reel.findFirst({
    where: { id: params.reelId, deletedAt: null },
    include: { product: true, watermarkedObject: true, cleanObject: true },
  });

  if (!reel || reel.product.deletedAt) {
    return { authorized: false as const, reason: "NOT_FOUND" as const };
  }

  const purchases = await db.purchase.findMany({
    where: { userId: params.userId, productId: reel.productId, status: "ACTIVE" },
    include: { order: true },
  });

  const ownedVariants = new Set(
    purchases.filter((p) => p.order.status === "PAID").map((p) => p.variant)
  );

  if (ownedVariants.size === 0) {
    return { authorized: false as const, reason: "NOT_OWNED" as const };
  }

  let variant: Variant;
  if (params.requestedVariant) {
    if (!ownedVariants.has(params.requestedVariant)) {
      return { authorized: false as const, reason: "NOT_OWNED" as const };
    }
    variant = params.requestedVariant;
  } else {
    variant = ownedVariants.has("CLEAN") ? "CLEAN" : "WATERMARKED";
  }

  const storageObject = variant === "CLEAN" ? reel.cleanObject : reel.watermarkedObject;
  if (!storageObject || storageObject.status !== "READY") {
    return { authorized: false as const, reason: "NOT_FOUND" as const };
  }

  return {
    authorized: true as const,
    reel,
    variant,
    storageObject,
  };
}

/** Validates a whole batch download request: every reelId must belong to the product and be owned at the (single, consistent) variant. */
export async function resolveBatchAccess(params: {
  userId: string;
  productId: string;
  variant: Variant;
  reelIds: string[];
}) {
  const entitlement = await entitlementForProduct(
    params.userId,
    params.productId,
    params.variant
  );

  if (!entitlement.authorized) return entitlement;

  const reels = await db.reel.findMany({
    where: {
      id: { in: params.reelIds },
      productId: params.productId,
      deletedAt: null,
    },
    include: { watermarkedObject: true, cleanObject: true },
  });

  const foundIds = new Set(reels.map((r) => r.id));
  const missing = params.reelIds.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    return { authorized: false as const, reason: "NOT_FOUND" as const, missing };
  }

  const variant = entitlement.variant;

  const usable = reels.filter((r) => {
    const obj = variant === "CLEAN" ? r.cleanObject : r.watermarkedObject;
    return obj && obj.status === "READY";
  });

  if (usable.length === 0) {
    return { authorized: false as const, reason: "NOT_FOUND" as const };
  }

  return { authorized: true as const, variant, reels: usable };
}

async function entitlementForProduct(
  userId: string,
  productId: string,
  requestedVariant: Variant
) {
  const purchases = await db.purchase.findMany({
    where: { userId, productId, status: "ACTIVE" },
    include: { order: true },
  });

  const paidVariants = purchases
    .filter((p) => p.order.status === "PAID")
    .map((p) => p.variant);

  if (paidVariants.length === 0) {
    return { authorized: false as const, reason: "NOT_OWNED" as const };
  }

  if (!paidVariants.includes(requestedVariant)) {
    return { authorized: false as const, reason: "NOT_OWNED" as const };
  }

  const variant = requestedVariant;

  return { authorized: true as const, variant };
}

export async function resolveBundlePlusExtraAccess(params: {
  userId: string;
  productId: string;
  extraId: string;
}) {
  const entitlement = await entitlementForProduct(
    params.userId,
    params.productId,
    "CLEAN"
  );

  if (!entitlement.authorized) {
    return entitlement;
  }

  const extra = await db.bundlePlusExtra.findFirst({
    where: {
      id: params.extraId,
      productId: params.productId,
    },
    include: {
      storageObject: true,
    },
  });

  if (!extra) {
    return {
      authorized: false as const,
      reason: "NOT_FOUND" as const,
    };
  }

  if (extra.type !== "FILE" || !extra.storageObject) {
    return {
      authorized: false as const,
      reason: "NOT_FOUND" as const,
    };
  }

  if (extra.storageObject.status !== "READY") {
    return {
      authorized: false as const,
      reason: "NOT_FOUND" as const,
    };
  }

  return {
    authorized: true as const,
    extra,
    storageObject: extra.storageObject,
  };
}
