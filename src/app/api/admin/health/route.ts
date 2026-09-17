import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { getHealthSnapshot } from "@/server/services/health.service";

/** Backs both the initial server-rendered Admin -> Health page and its client-side "Refresh" button. */
export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getHealthSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    return apiError(err);
  }
}
