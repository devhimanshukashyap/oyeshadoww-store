import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import {
  buildProductAssetKey,
  getObjectBuffer,
  objectExists,
  putObjectBuffer,
} from "@/lib/r2";
import sharp from "sharp";
import { logAdminAction } from "@/server/services/audit.service";

const completeSchema = z.object({
  storageObjectId: z.string().min(1),
  productId: z.string().optional(),
  kind: z.enum([
    "reel-watermarked",
    "reel-clean",
    "reel-thumbnail",
    "thumbnail",
    "preview",
    "bundle-plus-extra",
    "hero-video",
  ]),
  reelId: z.string().optional(), // attach to an existing reel
  newReelTitle: z.string().min(1).max(150).optional(), // or create a new reel with this title
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = completeSchema.parse(await req.json());

    const storageObject = await db.storageObject.findUnique({ where: { id: body.storageObjectId } });
    if (!storageObject) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const exists = await objectExists(storageObject.key);
    if (!exists) {
      await db.storageObject.update({ where: { id: storageObject.id }, data: { status: "FAILED" } });
      return NextResponse.json(
        { error: "Upload did not complete. Please retry." },
        { status: 422 }
      );
    }

    await db.storageObject.update({ where: { id: storageObject.id }, data: { status: "READY" } });

    if (body.kind === "hero-video") {
      if (!storageObject.key.startsWith("site/hero/")) {
        await db.storageObject.update({
          where: { id: storageObject.id },
          data: { status: "FAILED" },
        });

        return NextResponse.json(
          { error: "Invalid hero video upload." },
          { status: 422 }
        );
      }

      return NextResponse.json({
        ok: true,
        storageObjectId: storageObject.id,
        key: storageObject.key,
      });
    }

    if (body.kind === "bundle-plus-extra") {
      return NextResponse.json({
        ok: true,
        storageObjectId: storageObject.id,
        key: storageObject.key,
        fileName: storageObject.key.split("/").pop() ?? "file",
        fileContentType: storageObject.contentType,
        fileSizeBytes: storageObject.sizeBytes?.toString() ?? null,
      });
    }

    if (body.kind === "thumbnail" || body.kind === "preview") {
      if (!body.productId) {
        return NextResponse.json(
          { error: "Product ID is required." },
          { status: 400 },
        );
      }

      if (body.kind === "thumbnail") {
        const source = await getObjectBuffer(storageObject.key);

        const optimizedThumbnail = await sharp(source.body)
          .rotate()
          .resize({
            width: 640,
            withoutEnlargement: true,
          })
          .webp({
            quality: 82,
            effort: 4,
          })
          .toBuffer();

        const optimizedKey = buildProductAssetKey(
          body.productId,
          "thumbnail",
          "optimized.webp",
        );

        await putObjectBuffer({
          key: optimizedKey,
          body: optimizedThumbnail,
          contentType: "image/webp",
        });

        await db.product.update({
          where: { id: body.productId },
          data: { thumbnailKey: optimizedKey },
        });
      } else {
        await db.product.update({
          where: { id: body.productId },
          data: { previewVideoKey: storageObject.key },
        });
      }

      await logAdminAction({
        adminId: admin.id,
        action: `product.${body.kind}.set`,
        targetType: "Product",
        targetId: body.productId,
      });

      return NextResponse.json({ ok: true });
    }

    if (body.kind === "reel-thumbnail") {
      if (!body.reelId) {
        return NextResponse.json(
          { error: "Reel ID is required for a reel thumbnail." },
          { status: 400 }
        );
      }

      const reel = await db.reel.findFirst({
        where: {
          id: body.reelId,
          productId: body.productId,
          deletedAt: null,
        },
      });

      if (!reel) {
        return NextResponse.json(
          { error: "Reel not found." },
          { status: 404 }
        );
      }

      await db.reel.update({
        where: { id: reel.id },
        data: { thumbnailKey: storageObject.key },
      });

      await logAdminAction({
        adminId: admin.id,
        action: "reel.thumbnail.set",
        targetType: "Reel",
        targetId: reel.id,
      });

      return NextResponse.json({
        ok: true,
        reelId: reel.id,
        thumbnailKey: storageObject.key,
      });
    }

    // reel-watermarked / reel-clean
    const field = body.kind === "reel-watermarked" ? "watermarkedObjectId" : "cleanObjectId";

    let reelId = body.reelId;
    if (!reelId) {
      const maxSort = await db.reel.aggregate({
        where: { productId: body.productId },
        _max: { sortOrder: true },
      });
      const reel = await db.reel.create({
        data: {
          productId: body.productId,
          title: body.newReelTitle ?? "Untitled reel",
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          [field]: storageObject.id,
        } as any,
      });
      reelId = reel.id;
    } else {
      await db.reel.update({ where: { id: reelId }, data: { [field]: storageObject.id } as any });
    }

    await logAdminAction({
      adminId: admin.id,
      action: `reel.${body.kind}.attach`,
      targetType: "Reel",
      targetId: reelId,
    });

    const completedReel = await db.reel.findUnique({
      where: { id: reelId },
      select: { thumbnailKey: true },
    });

    return NextResponse.json({
      ok: true,
      reelId,
      thumbnailKey: completedReel?.thumbnailKey ?? null,
    });
  } catch (err) {
    return apiError(err);
  }
}
