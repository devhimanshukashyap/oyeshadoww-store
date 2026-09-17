import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { logAdminAction } from "@/server/services/audit.service";
import { nanoid } from "nanoid";

/**
 * Duplicates a product's metadata (NOT its reel files — those are unique
 * media and must be uploaded again for the new bundle) so creating a
 * "Volume 02" from "Volume 01" is quick.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const source = await db.product.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const copy = await db.product.create({
      data: {
        type: source.type,
        name: `${source.name} (Copy)`,
        slug: `${source.slug}-copy-${nanoid(6).toLowerCase()}`,
        categoryId: source.categoryId,
        description: source.description,
        shortDescription: source.shortDescription,
        watermarkedPriceInPaise: source.watermarkedPriceInPaise,
        cleanPriceInPaise: source.cleanPriceInPaise,
        currency: source.currency,
        status: "DRAFT",
        featured: false,
        purchasable: source.purchasable,
        sortOrder: source.sortOrder,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        licenseText: source.licenseText,
      },
    });

    await logAdminAction({ adminId: admin.id, action: "product.duplicate", targetType: "Product", targetId: copy.id, metadata: { sourceId: source.id } });

    return NextResponse.json({ product: copy }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
