import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  createPasswordResetToken,
} from "@/server/services/account.service";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);

    const limit = rateLimit(
      `forgot-password:${ip}`,
      5,
      600
    );

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Try again later.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { error: "Enter your email address." },
        { status: 400 }
      );
    }

    const result = await createPasswordResetToken(email);

    // Always return the same response, even when the account
    // doesn't exist. This prevents account enumeration.
    if (result) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

      const resetUrl =
        `${siteUrl}/reset-password?token=${encodeURIComponent(
          result.token
        )}`;

      await sendEmail({
        to: result.email,
        subject: "Reset your password — Oye Shadoww",
        text: `Reset your Oye Shadoww password using this link: ${resetUrl}. This link expires in 30 minutes.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin:0 0 12px">Reset your password</h2>

            <p>
              Hi ${escapeHtml(result.name ?? "there")},
            </p>

            <p>
              We received a request to reset your Oye Shadoww password.
            </p>

            <p style="margin:24px 0">
              <a
                href="${resetUrl}"
                style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block"
              >
                Reset password
              </a>
            </p>

            <p style="color:#666;font-size:13px">
              This link expires in 30 minutes and can only be used once.
            </p>

            <p style="color:#666;font-size:13px">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "If an account exists with that email, we've sent a password reset link.",
    });
  } catch (err) {
    return apiError(err);
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}