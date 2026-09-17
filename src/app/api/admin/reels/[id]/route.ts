import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { reelUpsertSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const body = reelUpsertSchema.partial().parse(await req.json());

    const reel = await db.reel.update({ where: { id: params.id }, data: body });
    await logAdminAction({ adminId: admin.id, action: "reel.update", targetType: "Reel", targetId: reel.id });
    return NextResponse.json({ reel });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * Soft delete. The underlying R2 files are intentionally NOT deleted
 * immediately — customers who already purchased the product may have an
 * in-progress batch job referencing this reel, and undelete should be
 * possible. Run a periodic cleanup once you're confident a reel deletion
 * is final (see docs/ADMIN_GUIDE.md "Removing a Reel").
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const reel = await db.reel.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), visibility: "HIDDEN" },
    });
    await logAdminAction({ adminId: admin.id, action: "reel.soft_delete", targetType: "Reel", targetId: reel.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
