import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const products = await db.product.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ products });
  } catch (err) {
    return apiError(err);
  }
}