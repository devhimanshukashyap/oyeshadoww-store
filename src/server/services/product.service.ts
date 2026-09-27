import { db } from "@/lib/db";

/** Public storefront queries. Always filters to PUBLISHED + not soft-deleted so drafts/archived items never leak. */

export async function listPublishedProducts(params?: { categorySlug?: string; featuredOnly?: boolean }) {
  return db.product.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      ...(params?.featuredOnly ? { featured: true } : {}),
      ...(params?.categorySlug
        ? { category: { slug: params.categorySlug, deletedAt: null } }
        : {}),
    },
    include: {
      category: true,
      _count: { select: { reels: { where: { deletedAt: null } } } },
    },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPublishedProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      category: true,

      reels: {
        where: { deletedAt: null, visibility: "VISIBLE" },
        orderBy: { sortOrder: "asc" },
      },

      _count: {
        select: {
          bundlePlusExtras: true,
        },
      },
    },
  });
}

export async function listActiveCategories() {
  return db.category.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getUserPurchases(userId: string) {
  return db.purchase.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      product: { include: { _count: { select: { reels: { where: { deletedAt: null } } } } } },
      order: true,
    },
    orderBy: { grantedAt: "desc" },
  });
}

export async function getUserOwnedVariants(
  userId: string,
  productId: string,
) {
  const purchases = await db.purchase.findMany({
    where: {
      userId,
      productId,
      status: "ACTIVE",
      order: {
        status: "PAID",
      },
    },
    select: {
      variant: true,
    },
  });

  return purchases.map((purchase) => purchase.variant);
}

export async function getPurchasedProductDetail(userId: string, productId: string) {
  const purchases = await db.purchase.findMany({
    where: { userId, productId, status: "ACTIVE" },
    include: { order: true },
  });

  const paid = purchases.filter((p) => p.order.status === "PAID");
  if (paid.length === 0) return null;

  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: {
      reels: {
        where: { deletedAt: null, visibility: "VISIBLE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) return null;

  const ownedVariants = paid.map((p) => p.variant);
  const hasBundlePlus = ownedVariants.includes("CLEAN");

  const bundlePlusExtras = hasBundlePlus
    ? await db.bundlePlusExtra.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        content: true,
        fileName: true,
        fileContentType: true,
        fileSizeBytes: true,
        sortOrder: true,
      },
    })
    : [];

  return {
    product,
    ownedVariants,
    bundlePlusExtras: bundlePlusExtras.map((extra) => ({
      ...extra,
      fileSizeBytes: extra.fileSizeBytes?.toString() ?? null,
    })),
  };
}
