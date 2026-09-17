import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";

/** Same validated-proxy pattern as /api/media/thumbnail, for the product's teaser preview clip. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const product = await db.product.findFirst({
    where: { previewVideoKey: key, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await createDownloadUrl({ key, expiresInSeconds: 3600 });
  return NextResponse.redirect(url, { status: 302 });
}
