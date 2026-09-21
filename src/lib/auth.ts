import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Single Credentials-based auth for both customers and admins. The account
 * is the same User table with a `role` field — an "admin" is just a User
 * with role=ADMIN. This keeps the system simple now (per the brief: don't
 * overbuild roles) while staying easy to extend later (SUPER_ADMIN,
 * CONTENT_MANAGER, ...) since role is already a first-class enum column.
 *
 * Brute-force protection: after too many failed attempts we lock the
 * account for a cooldown window (failedLoginCount / lockedUntil on User).
 * This is in addition to the IP-based rate limiter on the login route.
 */

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;
const ADMIN_CHALLENGE_MAX_AGE_MINUTES = 10;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        adminChallengeId: {
          label: "Admin challenge",
          type: "text",
        },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          // Constant-ish work so login timing doesn't reveal account existence.
          await bcrypt.compare(password, "$2a$10$invalidsaltinvalidsaltinvalidsal");
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.warn("auth.login_blocked_locked", { userId: user.id });
          throw new Error("Too many failed attempts. Try again later.");
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
            data: { failedLoginCount, lockedUntil },
          });
          logger.warn("auth.login_failed", { userId: user.id, failedLoginCount });
          return null;
        }

        if (user.role === "ADMIN") {
          const adminChallengeId =
            typeof credentials?.adminChallengeId === "string"
              ? credentials.adminChallengeId.trim()
              : "";

          if (!adminChallengeId) {
            throw new Error("Admin verification required.");
          }

          const challenge = await db.adminLoginChallenge.findFirst({
            where: {
              id: adminChallengeId,
              userId: user.id,
              verifiedAt: {
                not: null,
              },
              usedAt: null,
              expiresAt: {
                gt: new Date(),
              },
            },
          });

          if (!challenge) {
            throw new Error("Admin verification required.");
          }

          const verifiedAt = challenge.verifiedAt!.getTime();

          if (
            Date.now() - verifiedAt >
            ADMIN_CHALLENGE_MAX_AGE_MINUTES * 60 * 1000
          ) {
            throw new Error("Admin verification expired.");
          }

          await db.adminLoginChallenge.update({
            where: {
              id: challenge.id,
            },
            data: {
              usedAt: new Date(),
            },
          });
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role, sessionVersion: user.sessionVersion, };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = (user as any).id;
        token.sessionVersion = (user as any).sessionVersion;
      }
      // Lets the client explicitly refresh the session's name/email right
      // after a profile update (see useSession().update() calls in the
      // account management forms) without requiring a full logout/login.
      // Nothing here is trusted for authorization — role/uid are only
      // ever set from the `user` object above, at real sign-in time.
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.email === "string") token.email = session.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
