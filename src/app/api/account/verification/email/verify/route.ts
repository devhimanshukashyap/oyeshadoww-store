import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyChallenge } from "@/lib/verification";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(`verify-email-code:${user.id}:${ip}`, 10, 600);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();

    const challengeId =
      typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!challengeId || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit verification code." },
        { status: 400 }
      );
    }

    const result = await verifyChallenge({
      userId: user.id,
      challengeId,
      code,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        INVALID: "Invalid verification code.",
        ALREADY_USED: "This verification code has already been used.",
        EXPIRED: "This verification code has expired. Request a new one.",
        TOO_MANY_ATTEMPTS:
          "Too many incorrect attempts. Request a new verification code.",
      };

      return NextResponse.json(
        { error: messages[result.reason] ?? "Verification failed." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      verified: true,
    });
  } catch (err) {
    return apiError(err);
  }
}