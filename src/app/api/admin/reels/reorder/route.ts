import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";

const reorderSchema = z.object({
  productId: z.string().min(1),
  order: z.array(z.object({ reelId: z.string().min(1), sortOrder: z.number().int() })).min(1),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = reorderSchema.parse(await req.json());

    await db.$transaction(
      body.order.map((item) =>
        db.reel.updateMany({
          where: { id: item.reelId, productId: body.productId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
