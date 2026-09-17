import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { settingsUpdateSchema } from "@/lib/validation";
import { logAdminAction } from "@/server/services/audit.service";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = settingsUpdateSchema.parse(await req.json());

    // Only allow known keys — reject anything not in DEFAULT_SETTINGS so
    // the settings table can never be used to smuggle arbitrary data.
    const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.has(key)) filtered[key] = value;
    }

    await updateSettings(filtered);
    await logAdminAction({ adminId: admin.id, action: "settings.update", metadata: { keys: Object.keys(filtered) } });

    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return apiError(err);
  }
}
