import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { AccountError } from "@/server/services/account.service";
import { verifyAdminEmailChangeChallenge } from "@/lib/verification";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const ip = getClientIp(request.headers);

    const limit = rateLimit(
      `admin-email-change-verify:${user.id}:${ip}`,
      10,
      600
    );

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many verification attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    const challengeId =
      typeof body.challengeId === "string"
        ? body.challengeId.trim()
        : "";

    const code =
      typeof body.code === "string"
        ? body.code.trim()
        : "";

    if (!challengeId || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          error: "Enter the 6-digit verification code.",
        },
        { status: 400 }
      );
    }

    const result = await verifyAdminEmailChangeChallenge({
      userId: user.id,
      challengeId,
      code,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        INVALID: "Invalid verification code.",
        ALREADY_USED: "This verification code has already been used.",
        EXPIRED:
          "This verification code has expired. Request a new one.",
        TOO_MANY_ATTEMPTS:
          "Too many incorrect attempts. Request a new verification code.",
        EMAIL_UNAVAILABLE:
          "That email address can't be used.",
      };

      return NextResponse.json(
        {
          error:
            messages[result.reason] ?? "Verification failed.",
        },
        { status: 400 }
      );
    }

    logger.info("admin.account.email_changed", {
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      email: result.email,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    logger.error("admin.account.email_change_verification_failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Unable to change email.",
      },
      { status: 500 }
    );
  }
}