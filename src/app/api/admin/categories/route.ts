import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { categoryUpsertSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";

export async function GET() {
  try {
    await requireAdmin();
    const categories = await db.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ categories });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = categoryUpsertSchema.parse(await req.json());

    const clash = await db.category.findUnique({ where: { slug: body.slug } });
    if (clash) return NextResponse.json({ error: "A category with this slug already exists." }, { status: 409 });

    const category = await db.category.create({ data: body });
    await logAdminAction({ adminId: admin.id, action: "category.create", targetType: "Category", targetId: category.id });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
