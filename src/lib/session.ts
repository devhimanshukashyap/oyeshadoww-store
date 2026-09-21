import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    return null;
  }

  const tokenVersion = (session.user as { sessionVersion?: number })
    .sessionVersion;

  if (
    typeof tokenVersion !== "number" ||
    tokenVersion !== user.sessionVersion
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
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
