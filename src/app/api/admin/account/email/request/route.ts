import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  AccountError,
  changeAdminEmail,
} from "@/server/services/account.service";
import {
  createVerificationChallenge,
} from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const ip = getClientIp(request.headers);

    const limit = rateLimit(
      `admin-email-change:${user.id}:${ip}`,
      5,
      600
    );

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    const newEmail =
      typeof body.newEmail === "string"
        ? body.newEmail.trim().toLowerCase()
        : "";

    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";

    if (!newEmail || !currentPassword) {
      return NextResponse.json(
        {
          error: "New email and current password are required.",
        },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json(
        {
          error: "Enter a valid email address.",
        },
        { status: 400 }
      );
    }

    const result = await changeAdminEmail(
      user.id,
      newEmail,
      currentPassword
    );

    const challenge = await createVerificationChallenge({
      userId: user.id,
      type: "EMAIL",
      target: result.newEmail,
    });

    await sendEmail({
      to: result.newEmail,
      subject: "Verify your new admin email",
      text: `Your verification code is ${challenge.code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Verify your new admin email</h2>

          <p>
            You requested to change the email address used for your
            administrator account.
          </p>

          <p>Your verification code is:</p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 24px 0;
          ">
            ${challenge.code}
          </div>

          <p>This code expires in 10 minutes.</p>

          <p>
            If you did not request this change, you can safely ignore
            this email.
          </p>
        </div>
      `,
    });

    logger.info("admin.account.email_change_requested", {
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      challengeId: challenge.challengeId,
      email: result.newEmail,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    logger.error("admin.account.email_change_request_failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Unable to start email change.",
      },
      { status: 500 }
    );
  }
}