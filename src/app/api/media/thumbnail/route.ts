import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";

/**
 * Thumbnails and preview clips need to be visible to anonymous visitors
 * browsing the storefront (they're marketing images, not the paid
 * product), but the R2 bucket itself stays private end-to-end — nothing
 * is ever marked public at the bucket level. This route is the one
 * narrow, validated exception: it will only sign a URL for a key that is
 * actually registered as a PUBLISHED product's thumbnail, and the
 * resulting URL still expires (1 hour) rather than being permanent.
 *
 * This intentionally does NOT accept arbitrary keys — a request for a key
 * that isn't a known product thumbnail is rejected, which prevents this
 * route from being used to read arbitrary private reel files.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const product = await db.product.findFirst({
    where: { thumbnailKey: key, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await createDownloadUrl({ key, expiresInSeconds: 3600 });
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
