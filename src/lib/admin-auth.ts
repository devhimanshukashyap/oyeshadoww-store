import crypto from "crypto";
import { db } from "@/lib/db";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
    return crypto
        .randomInt(0, 10 ** OTP_LENGTH)
        .toString()
        .padStart(OTP_LENGTH, "0");
}

export async function createAdminLoginChallenge(userId: string) {
    const recent = await db.adminLoginChallenge.findFirst({
        where: {
            userId,
            usedAt: null,
            createdAt: {
                gte: new Date(
                    Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000
                ),
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    if (recent) {
        const error = new Error(
            `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`
        );

        (error as Error & { status?: number }).status = 429;

        throw error;
    }

    await db.adminLoginChallenge.updateMany({
        where: {
            userId,
            usedAt: null,
        },
        data: {
            usedAt: new Date(),
        },
    });

    const code = generateOtp();

    const challenge = await db.adminLoginChallenge.create({
        data: {
            userId,
            codeHash: hashCode(code),
            expiresAt: new Date(
                Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
            ),
        },
    });

    return {
        challengeId: challenge.id,
        code,
        expiresAt: challenge.expiresAt,
    };
}

export async function verifyAdminLoginChallenge(params: {
    challengeId: string;
    code: string;
}) {
    const challenge = await db.adminLoginChallenge.findFirst({
        where: {
            id: params.challengeId,
        },
    });

    if (!challenge) {
        return {
            success: false,
            reason: "INVALID",
        } as const;
    }

    if (challenge.usedAt) {
        return {
            success: false,
            reason: "ALREADY_USED",
        } as const;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
        return {
            success: false,
            reason: "EXPIRED",
        } as const;
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
        return {
            success: false,
            reason: "TOO_MANY_ATTEMPTS",
        } as const;
    }

    const submittedHash = hashCode(params.code.trim());

    const matches = crypto.timingSafeEqual(
        Buffer.from(submittedHash, "hex"),
        Buffer.from(challenge.codeHash, "hex")
    );

    if (!matches) {
        const updated = await db.adminLoginChallenge.update({
            where: {
                id: challenge.id,
            },
            data: {
                attempts: {
                    increment: 1,
                },
            },
            select: {
                attempts: true,
            },
        });

        return {
            success: false,
            reason:
                updated.attempts >= MAX_ATTEMPTS
                    ? "TOO_MANY_ATTEMPTS"
                    : "INVALID",
        } as const;
    }

    await db.adminLoginChallenge.update({
        where: {
            id: challenge.id,
        },
        data: {
            verifiedAt: new Date(),
        },
    });

    return {
        success: true,
    } as const;
}