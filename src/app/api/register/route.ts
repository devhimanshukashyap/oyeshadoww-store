import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limit = rateLimit(`register:${ip}`, 10, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // Generic message — never reveal whether an email is registered.
      return NextResponse.json(
        { error: "Could not create account with those details." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(body.password);
    const user = await db.user.create({
      data: { name: body.name, email, passwordHash, role: "CUSTOMER" },
    });

    logger.info("user.registered", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
