import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { uploadUrlRequestSchema } from "@/lib/validation";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  buildBundlePlusExtraKey,
  buildHeroVideoKey,
  buildProductAssetKey,
  buildReelKey,
  buildReelThumbnailKey,
  createUploadUrl,
} from "@/lib/r2";
import { nanoid } from "nanoid";

/**
 * Step 1 of the admin upload flow: the browser asks for a presigned PUT
 * URL. Files go straight from the admin's browser to R2 (never proxied
 * through our server, which would be slow for large video files). We
 * validate content-type/size BEFORE issuing the URL, and record a
 * StorageObject row in status=UPLOADING so an interrupted/abandoned
 * upload is visible and can be garbage-collected later instead of
 * silently vanishing.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = uploadUrlRequestSchema.parse(await req.json());

    const isVideo =
      body.kind === "reel-watermarked" ||
      body.kind === "reel-clean" ||
      body.kind === "preview" ||
      body.kind === "hero-video";

    const isBundlePlusExtra = body.kind === "bundle-plus-extra";

    const allowed = isBundlePlusExtra
      ? new Set([
        "application/pdf",
        "text/plain",
        "application/zip",
        "application/x-zip-compressed",
      ])
      : isVideo
        ? ALLOWED_VIDEO_TYPES
        : ALLOWED_IMAGE_TYPES;

    const maxBytes = isBundlePlusExtra
      ? 25 * 1024 * 1024
      : isVideo
        ? MAX_VIDEO_BYTES
        : MAX_IMAGE_BYTES;

    if (!allowed.has(body.contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${body.contentType}" for ${body.kind}.` },
        { status: 415 }
      );
    }
    if (body.sizeBytes > maxBytes) {
      return NextResponse.json(
        { error: `File is too large. Max allowed is ${Math.round(maxBytes / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    const isHeroVideo = body.kind === "hero-video";

    const product = isHeroVideo
      ? null
      : await db.product.findFirst({
        where: { id: body.productId, deletedAt: null },
      });

    if (!isHeroVideo && !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const reelId = body.reelId ?? `pending-${nanoid(12)}`;

    const key =
      body.kind === "hero-video"
        ? buildHeroVideoKey(body.filename)
        : body.kind === "bundle-plus-extra"
          ? buildBundlePlusExtraKey(
            product!.id,
            nanoid(12),
            body.filename
          )
          : body.kind === "reel-thumbnail"
            ? buildReelThumbnailKey(product!.id, reelId)
            : isVideo
              ? buildReelKey(
                product!.id,
                reelId,
                body.kind === "reel-watermarked" ? "watermarked" : "clean",
                body.filename
              )
              : buildProductAssetKey(
                product!.id,
                body.kind === "thumbnail" ? "thumbnail" : "preview",
                body.filename
              );

    const storageObject = await db.storageObject.create({
      data: {
        bucket: process.env.R2_BUCKET_NAME ?? "",
        key,
        contentType: body.contentType,
        sizeBytes: BigInt(body.sizeBytes),
        status: "UPLOADING",
      },
    });

    const uploadUrl = await createUploadUrl({ key, contentType: body.contentType });

    return NextResponse.json({
      uploadUrl,
      storageObjectId: storageObject.id,
      key,
      pendingReelId: body.reelId ? undefined : reelId,
    });
  } catch (err) {
    return apiError(err);
  }
}
