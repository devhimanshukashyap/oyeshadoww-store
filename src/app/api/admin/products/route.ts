import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { productUpsertSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";

/**
 * All /api/admin/* routes are additionally protected by middleware.ts,
 * but each one still independently calls requireAdmin() here. Never rely
 * on middleware as the only gate for an API route — see docs/SECURITY.md.
 */
export async function GET() {
  try {
    await requireAdmin();
    const products = await db.product.findMany({
      where: { deletedAt: null },
      include: { category: true, _count: { select: { reels: { where: { deletedAt: null } } } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ products });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = productUpsertSchema.parse(await req.json());

    const existingSlug = await db.product.findUnique({ where: { slug: body.slug } });
    if (existingSlug) {
      return NextResponse.json({ error: "A product with this slug already exists." }, { status: 409 });
    }

    const product = await db.product.create({
      data: {
        name: body.name,
        slug: body.slug,
        categoryId: body.categoryId ?? null,
        description: body.description,
        shortDescription: body.shortDescription ?? null,
        watermarkedPriceInPaise: body.watermarkedPriceInPaise ?? null,
        cleanPriceInPaise: body.cleanPriceInPaise ?? null,
        status: body.status,
        featured: body.featured,
        purchasable: body.purchasable,
        sortOrder: body.sortOrder,
        seoTitle: body.seoTitle ?? null,
        seoDescription: body.seoDescription ?? null,
        licenseText: body.licenseText ?? null,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      action: "product.create",
      targetType: "Product",
      targetId: product.id,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
