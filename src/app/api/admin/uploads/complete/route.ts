import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { objectExists } from "@/lib/r2";
import { logAdminAction } from "@/server/services/audit.service";

const completeSchema = z.object({
  storageObjectId: z.string().min(1),
  productId: z.string().min(1),
  kind: z.enum(["reel-watermarked", "reel-clean", "thumbnail", "preview"]),
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

    if (body.kind === "thumbnail" || body.kind === "preview") {
      await db.product.update({
        where: { id: body.productId },
        data:
          body.kind === "thumbnail"
            ? { thumbnailKey: storageObject.key }
            : { previewVideoKey: storageObject.key },
      });
      await logAdminAction({
        adminId: admin.id,
        action: `product.${body.kind}.set`,
        targetType: "Product",
        targetId: body.productId,
      });
      return NextResponse.json({ ok: true });
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

    return NextResponse.json({ ok: true, reelId });
  } catch (err) {
    return apiError(err);
  }
}
