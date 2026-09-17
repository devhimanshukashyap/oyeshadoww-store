import { PrismaClient } from "@prisma/client";

// Standard Next.js-safe Prisma singleton: avoids exhausting DB connections
// from hot-reloading in development, where modules are re-evaluated often.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
