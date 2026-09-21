import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  AccountError,
  changePassword,
} from "@/server/services/account.service";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const rate = rateLimit(
      `admin-account-password:${user.id}`,
      5,
      600
    );

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";

    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          error: "Current password and new password are required.",
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          error: "New password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        {
          error: "New password is too long.",
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          error: "New password must be different from your current password.",
        },
        { status: 400 }
      );
    }

    await changePassword(
      user.id,
      currentPassword,
      newPassword
    );

    logger.info("admin.account.password_changed", {
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    logger.error("admin.account.password_change_failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Unable to change password.",
      },
      { status: 500 }
    );
  }
}