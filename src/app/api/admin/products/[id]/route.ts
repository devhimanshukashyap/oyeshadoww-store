import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { productUpsertSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";

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

/** Soft delete only — historical Orders/Purchases must keep referencing this product row. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const product = await db.product.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: "ARCHIVED", purchasable: false },
    });
    await logAdminAction({ adminId: admin.id, action: "product.soft_delete", targetType: "Product", targetId: product.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
