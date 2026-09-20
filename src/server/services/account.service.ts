import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";

export class AccountError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function updateProfileName(userId: string, name: string) {
  const user = await db.user.update({ where: { id: userId }, data: { name } });
  logger.info("account.name_updated", { userId });
  return { name: user.name };
}

/**
 * Changing email requires the current password — this is a sensitive
 * field (it's also the login identifier), so we don't let a hijacked but
 * unlocked session change it without re-proving the password, same as
 * most account settings pages (GitHub, Stripe, etc).
 */
export async function changeEmail(userId: string, newEmail: string, currentPassword: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AccountError("Account not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AccountError("Current password is incorrect", 401);

  const normalized = newEmail.trim().toLowerCase();
  if (normalized === user.email) {
    throw new AccountError("That's already your current email address", 409);
  }

  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    // Generic message — never reveal that a specific email is already
    // registered to someone else.
    throw new AccountError("That email address can't be used", 409);
  }

  await db.user.update({ where: { id: userId }, data: { email: normalized } });
  logger.info("account.email_changed", { userId });
  return { email: normalized };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AccountError("Account not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AccountError("Current password is incorrect", 401);

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  logger.info("account.password_changed", { userId });
}

/** Full order history (every status, not just PAID) — distinct from "My Purchases," which only shows active entitlements. */
export async function getUserOrderHistory(userId: string) {
  return db.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Recent download activity for the account's "history" section — read-only, capped so the query stays cheap. */
export async function getUserDownloadHistory(userId: string, limit = 15) {
  return db.downloadLog.findMany({
    where: { userId },
    include: { reel: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

const PASSWORD_RESET_EXPIRY_MINUTES = 30;

export async function createPasswordResetToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return null;
  }

  // Invalidate any previous unused reset tokens.
  await db.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const resetToken = await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(
        Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
      ),
    },
  });

  logger.info("account.password_reset_requested", {
    userId: user.id,
  });

  return {
    token: rawToken,
    expiresAt: resetToken.expiresAt,
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function resetPassword(
  rawToken: string,
  newPassword: string
) {
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken) {
    throw new AccountError("This password reset link is invalid.", 400);
  }

  if (resetToken.usedAt) {
    throw new AccountError(
      "This password reset link has already been used.",
      400
    );
  }

  if (resetToken.expiresAt.getTime() <= Date.now()) {
    throw new AccountError(
      "This password reset link has expired.",
      400
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),

    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        usedAt: new Date(),
      },
    }),

    db.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: {
          not: resetToken.id,
        },
      },
      data: {
        usedAt: new Date(),
      },
    }),
  ]);

  logger.info("account.password_reset_completed", {
    userId: resetToken.userId,
  });
}
