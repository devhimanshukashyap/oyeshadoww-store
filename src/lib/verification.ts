import crypto from "crypto";
import { db } from "@/lib/db";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export type VerificationType = "EMAIL" | "PHONE";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;

  return crypto
    .randomInt(0, max)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

function normalizeTarget(type: VerificationType, target: string): string {
  const value = target.trim();

  return type === "EMAIL" ? value.toLowerCase() : value;
}

export async function createVerificationChallenge(params: {
  userId: string;
  type: VerificationType;
  target: string;
}) {
  const target = normalizeTarget(params.type, params.target);

  const recent = await db.verificationChallenge.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      target,
      createdAt: {
        gte: new Date(
          Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000
        ),
      },
      usedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (recent) {
    throw new Error(
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`
    );
  }

  // Invalidate older unused challenges for the same target.
  await db.verificationChallenge.updateMany({
    where: {
      userId: params.userId,
      type: params.type,
      target,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const code = generateOtp();

  const challenge = await db.verificationChallenge.create({
    data: {
      userId: params.userId,
      type: params.type,
      target,
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

export async function verifyChallenge(params: {
  userId: string;
  challengeId: string;
  code: string;
}) {
  const challenge = await db.verificationChallenge.findFirst({
    where: {
      id: params.challengeId,
      userId: params.userId,
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
    const updated = await db.verificationChallenge.update({
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

  await db.$transaction([
    db.verificationChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        usedAt: new Date(),
      },
    }),

    db.user.update({
      where: {
        id: challenge.userId,
      },
      data:
        challenge.type === "EMAIL"
          ? {
              emailVerifiedAt: new Date(),
            }
          : {
              phoneVerifiedAt: new Date(),
            },
    }),
  ]);

  return {
    success: true,
    type: challenge.type,
    target: challenge.target,
  } as const;
}
