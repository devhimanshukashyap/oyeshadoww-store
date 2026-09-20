import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAdminLoginChallenge } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
    try {
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown";

        const rate = rateLimit(`admin-login-verify:${ip}`, 10, 600);

        if (!rate.allowed) {
            return NextResponse.json(
                { error: "Too many verification attempts. Please try again later." },
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

        if (!challengeId || !code) {
            return NextResponse.json(
                { error: "Verification details are required." },
                { status: 400 }
            );
        }

        if (!/^\d{6}$/.test(code)) {
            return NextResponse.json(
                { error: "Enter a valid 6-digit verification code." },
                { status: 400 }
            );
        }

        const result = await verifyAdminLoginChallenge({
            challengeId,
            code,
        });

        if (!result.success) {
            const messages = {
                INVALID: "Invalid verification code.",
                ALREADY_USED: "This verification code has already been used.",
                EXPIRED: "This verification code has expired.",
                TOO_MANY_ATTEMPTS:
                    "Too many incorrect attempts. Please request a new code.",
            } as const;

            return NextResponse.json(
                {
                    error:
                        messages[result.reason] ?? "Verification failed.",
                },
                { status: 401 }
            );
        }

        logger.info("admin.login_otp_verified", {
            challengeId,
        });

        return NextResponse.json({
            success: true,
            challengeId,
        });
    } catch (error) {
        logger.error("admin.login_otp_verification_failed", {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { error: "Unable to verify the code." },
            { status: 500 }
        );
    }
}