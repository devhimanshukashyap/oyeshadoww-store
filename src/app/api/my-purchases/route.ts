import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { getUserPurchases } from "@/server/services/product.service";

export async function GET() {
  try {
    const user = await requireUser();
    const purchases = await getUserPurchases(user.id);
    return NextResponse.json({ purchases });
  } catch (err) {
    return apiError(err);
  }
}
