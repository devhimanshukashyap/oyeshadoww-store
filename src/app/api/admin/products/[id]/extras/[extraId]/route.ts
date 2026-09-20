import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/r2";
import { logAdminAction } from "@/server/services/audit.service";
import { z } from "zod";

const updateExtraSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  content: z.string().max(50000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: { id: string; extraId: string };
  }
) {
  try {
    const admin = await requireAdmin();

    const body = updateExtraSchema.parse(await req.json());

    const existing = await db.bundlePlusExtra.findFirst({
      where: {
        id: params.extraId,
        productId: params.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Extra not found." },
        { status: 404 }
      );
    }

    const extra = await db.bundlePlusExtra.update({
      where: {
        id: existing.id,
      },
      data: {
        ...body,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      action: "bundle_plus_extra.update",
      targetType: "BundlePlusExtra",
      targetId: extra.id,
    });

    return NextResponse.json({
      extra: {
        ...extra,
        fileSizeBytes: extra.fileSizeBytes?.toString() ?? null,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: { id: string; extraId: string };
  }
) {
  try {
    const admin = await requireAdmin();

    const existing = await db.bundlePlusExtra.findFirst({
      where: {
        id: params.extraId,
        productId: params.id,
      },
      include: {
        storageObject: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Extra not found." },
        { status: 404 }
      );
    }

    // Delete the R2 file first for FILE extras.
    if (existing.type === "FILE" && existing.storageObject) {
      await deleteObject(existing.storageObject.key);
    }

    await db.bundlePlusExtra.delete({
      where: {
        id: existing.id,
      },
    });

    // Remove the StorageObject database record after the extra is deleted.
    if (existing.storageObjectId) {
      await db.storageObject.delete({
        where: {
          id: existing.storageObjectId,
        },
      });
    }

    await logAdminAction({
      adminId: admin.id,
      action: "bundle_plus_extra.delete",
      targetType: "BundlePlusExtra",
      targetId: existing.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}