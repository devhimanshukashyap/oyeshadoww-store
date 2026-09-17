import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = 25;

    const where: any = {
      role: "CUSTOMER",
      ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
    };

    const [customers, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { orders: true, purchases: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    // Never expose password hashes or lockout internals to the client.
    const sanitized = customers.map(({ passwordHash, failedLoginCount, lockedUntil, ...rest }) => rest);

    return NextResponse.json({ customers: sanitized, total, page, pageSize });
  } catch (err) {
    return apiError(err);
  }
}
