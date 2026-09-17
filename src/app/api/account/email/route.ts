import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { changeEmailSchema } from "@/lib/validation";
import { changeEmail } from "@/server/services/account.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    // Tighter limit than a normal profile edit — this is a
    // password-confirmed, security-sensitive action.
    const limit = rateLimit(`account-email:${user.id}:${ip}`, 8, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = changeEmailSchema.parse(await req.json());
    const result = await changeEmail(user.id, body.newEmail, body.currentPassword);

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
