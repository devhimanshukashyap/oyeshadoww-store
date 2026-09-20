import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/r2";
import { logAdminAction } from "@/server/services/audit.service";
import { z } from "zod";

const createExtraSchema = z.object({
  type: z.enum(["TEXT", "FILE"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  content: z.string().max(50000).nullable().optional(),
  storageObjectId: z.string().min(1).nullable().optional(),
  fileName: z.string().max(255).nullable().optional(),
  fileContentType: z.string().max(200).nullable().optional(),
  fileSizeBytes: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const product = await db.product.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const extras = await db.bundlePlusExtra.findMany({
      where: { productId: params.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const serializedExtras = extras.map((extra) => ({
      ...extra,
      fileSizeBytes: extra.fileSizeBytes?.toString() ?? null,
    }));

    return NextResponse.json({ extras: serializedExtras });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();

    const product = await db.product.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const body = createExtraSchema.parse(await req.json());

    if (body.type === "TEXT" && !body.content?.trim()) {
      return NextResponse.json(
        { error: "Text extras must have some content." },
        { status: 400 }
      );
    }

    if (body.type === "FILE" && !body.storageObjectId) {
      return NextResponse.json(
        { error: "File extras must have a file." },
        { status: 400 }
      );
    }

    let storageObject = null;

    if (body.type === "FILE") {
      storageObject = await db.storageObject.findFirst({
        where: {
          id: body.storageObjectId!,
          status: "READY",
        },
      });

      if (!storageObject) {
        return NextResponse.json(
          { error: "Uploaded file was not found or is not ready." },
          { status: 400 }
        );
      }

      if (!storageObject.key.startsWith(`products/${params.id}/extras/`)) {
        return NextResponse.json(
          { error: "Uploaded file does not belong to this product." },
          { status: 400 }
        );
      }
    }

    let extra;

    try {
      extra = await db.bundlePlusExtra.create({
        data: {
          productId: params.id,
          type: body.type,
          title: body.title,
          description: body.description ?? null,
          content: body.type === "TEXT" ? body.content ?? null : null,
          storageObjectId:
            body.type === "FILE" ? body.storageObjectId ?? null : null,
          fileName: body.type === "FILE" ? body.fileName ?? null : null,
          fileContentType:
            body.type === "FILE" ? body.fileContentType ?? null : null,
          fileSizeBytes:
            body.type === "FILE" ? body.fileSizeBytes ?? null : null,
          sortOrder: body.sortOrder,
        },
      });

      await logAdminAction({
        adminId: admin.id,
        action: "bundle_plus_extra.create",
        targetType: "BundlePlusExtra",
        targetId: extra.id,
      });
    } catch (error) {
      // If a FILE upload reached R2 but creating the extra failed,
      // clean up the uploaded object so it does not become orphaned.
      if (body.type === "FILE" && storageObject) {
        try {
          await deleteObject(storageObject.key);

          await db.storageObject.delete({
            where: {
              id: storageObject.id,
            },
          });
        } catch (cleanupError) {
          console.error("Failed to clean up Bundle+ extra upload:", cleanupError);
        }
      }

      throw error;
    }

    return NextResponse.json(
      {
        extra: {
          ...extra,
          fileSizeBytes: extra.fileSizeBytes?.toString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return apiError(err);
  }
}