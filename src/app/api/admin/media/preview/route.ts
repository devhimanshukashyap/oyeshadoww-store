import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const key = req.nextUrl.searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Missing media key." },
        { status: 400 },
      );
    }

    const product = await db.product.findFirst({
      where: {
        previewVideoKey: key,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Preview video not found." },
        { status: 404 },
      );
    }

    const url = await createDownloadUrl({
      key,
      expiresInSeconds: 120,
    });

    return NextResponse.redirect(url);
  } catch (err) {
    return apiError(err);
  }
}