import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { resetPassword } from "@/server/services/account.service";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);

    const limit = rateLimit(
      `reset-password:${ip}`,
      10,
      600
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = resetPasswordSchema.parse(await req.json());

    await resetPassword(body.token, body.newPassword);

    return NextResponse.json({
      ok: true,
    });
  } catch (err) {
    return apiError(err);
  }
}