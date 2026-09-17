import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { changePasswordSchema } from "@/lib/validation";
import { changePassword } from "@/server/services/account.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(`account-password:${user.id}:${ip}`, 8, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = changePasswordSchema.parse(await req.json());
    await changePassword(user.id, body.currentPassword, body.newPassword);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
