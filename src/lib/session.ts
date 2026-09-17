import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Central helpers for "who is calling this?" checks. Every API route and
 * server component that needs auth goes through these — never through an
 * ad-hoc cookie read — so authorization logic stays in one place and is
 * always enforced server-side (see middleware.ts for the route-level net
 * as well; this is the second, deeper layer that actually checks DB-backed
 * role, not just "a session cookie exists").
 */

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Not authorized") {
    super(message);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}
