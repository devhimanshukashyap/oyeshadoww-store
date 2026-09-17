import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";

/** Validated proxy for individual reel poster/thumbnail images (visible on product + purchase pages, not the full video file). */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const reel = await db.reel.findFirst({
    where: { thumbnailKey: key, deletedAt: null, visibility: "VISIBLE", product: { deletedAt: null } },
    select: { id: true },
  });

  if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await createDownloadUrl({ key, expiresInSeconds: 3600 });
  return NextResponse.redirect(url, { status: 302 });
}
