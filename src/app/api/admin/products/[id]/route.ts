import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { productUpsertSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";
import { deleteObjectsByPrefix } from "@/lib/r2";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const product = await db.product.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        category: true,
        reels: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, include: { watermarkedObject: true, cleanObject: true } },
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const body = productUpsertSchema.partial().parse(await req.json());

    if (body.slug) {
      const clash = await db.product.findFirst({ where: { slug: body.slug, NOT: { id: params.id } } });
      if (clash) return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
    }

    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...body,
        categoryId: body.categoryId === undefined ? undefined : body.categoryId,
      },
    });

    await logAdminAction({ adminId: admin.id, action: "product.update", targetType: "Product", targetId: product.id });

    return NextResponse.json({ product });
  } catch (err) {
    return apiError(err);
  }
}

/** Soft delete the product while cleaning its R2 assets when no active customer entitlement exists. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();

    const product = await db.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const activePurchases = await db.purchase.count({
      where: {
        productId: product.id,
        status: "ACTIVE",
      },
    });

    const assetsCanBeDeleted = activePurchases === 0;

    let deletedAssetCount = 0;

    if (assetsCanBeDeleted) {
      deletedAssetCount = await deleteObjectsByPrefix(
        `products/${product.id}/`,
      );
    }

    await db.product.update({
      where: { id: product.id },
      data: {
        deletedAt: product.deletedAt ?? new Date(),
        status: "ARCHIVED",
        purchasable: false,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      action: assetsCanBeDeleted
        ? "product.soft_delete"
        : "product.soft_delete_preserve_assets",
      targetType: "Product",
      targetId: product.id,
    });

    return NextResponse.json({
      ok: true,
      assetsDeleted: assetsCanBeDeleted,
      deletedAssetCount,
    });
  } catch (err) {
    return apiError(err);
  }
}
