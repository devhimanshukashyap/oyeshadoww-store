import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createAdminLoginChallenge } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
    try {
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown";

        const rate = await rateLimit(`admin-login-start:${ip}`, 10, 600);

        if (!rate.allowed) {
            return NextResponse.json(
                { error: "Too many login attempts. Please try again later." },
                { status: 429 }
            );
        }

        const body = await request.json();

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const password =
            typeof body.password === "string"
                ? body.password
                : "";

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required." },
                { status: 400 }
            );
        }

        const user = await db.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Keep timing reasonably similar for unknown accounts.
            await bcrypt.compare(
                password,
                "$2a$10$invalidsaltinvalidsaltinvalidsal"
            );

            return NextResponse.json(
                { error: "Invalid email or password." },
                { status: 401 }
            );
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            logger.warn("admin.login_blocked_locked", {
                userId: user.id,
            });

            return NextResponse.json(
                { error: "Too many failed attempts. Try again later." },
                { status: 429 }
            );
        }

        if (user.role !== "ADMIN") {
            await bcrypt.compare(password, user.passwordHash);

            return NextResponse.json(
                { error: "Invalid email or password." },
                { status: 401 }
            );
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
            const failedLoginCount = user.failedLoginCount + 1;

            const lockedUntil =
                failedLoginCount >= MAX_FAILED_ATTEMPTS
                    ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
                    : null;

            await db.user.update({
                where: { id: user.id },
                data: {
                    failedLoginCount,
                    lockedUntil,
                },
            });

            logger.warn("admin.login_failed", {
                userId: user.id,
                failedLoginCount,
            });

            return NextResponse.json(
                { error: "Invalid email or password." },
                { status: 401 }
            );
        }

        const challenge = await createAdminLoginChallenge(user.id);

        await sendEmail({
            to: user.email,
            subject: "Your admin verification code",
            text: `Your admin verification code is ${challenge.code}. It expires in 10 minutes.`,
            html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hey S H A D O W - Admin verification</h2>
      <p>Use the following code to complete your admin login:</p>

      <div style="
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 8px;
        margin: 24px 0;
      ">
        ${challenge.code}
      </div>

      <p>This code expires in 10 minutes.</p>
      <p>If you did not try to sign in, you can safely ignore this email.</p>
    </div>
  `,
        });

        return NextResponse.json({
            success: true,
            challengeId: challenge.challengeId,
            userId: user.id,
        });
    } catch (error) {
        const status =
            error instanceof Error &&
                "status" in error &&
                typeof (error as { status?: unknown }).status === "number"
                ? (error as { status: number }).status
                : 500;

        if (status === 429) {
            return NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Please wait before requesting another code.",
                },
                { status: 429 }
            );
        }

        logger.error("admin.login_start_failed", {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { error: "Unable to start admin login." },
            { status: 500 }
        );
    }
}