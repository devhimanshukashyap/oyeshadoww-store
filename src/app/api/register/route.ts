import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createVerificationChallenge } from "@/lib/verification";
import { sendEmail } from "@/lib/email";

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
      data: {
        name: body.name,
        email,
        phone: body.phone,
        passwordHash,
        role: "CUSTOMER",
      },
    });

    const challenge = await createVerificationChallenge({
      userId: user.id,
      type: "EMAIL",
      target: user.email,
    });

    await sendEmail({
      to: user.email,
      subject: "Verify your email — Oye Shadoww",
      text: `Your Oye Shadoww verification code is ${challenge.code}. This code expires in 10 minutes.`,
      html: `
    <p>Hi ${user.name ?? "there"},</p>
    <p>Thanks for creating your Oye Shadoww account.</p>
    <p>Your email verification code is:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">
      ${challenge.code}
    </p>
    <p>This code expires in 10 minutes.</p>
    <p>If you didn't create this account, you can ignore this email.</p>
  `,
    });

    logger.info("user.registered", { userId: user.id });

    return NextResponse.json({
      ok: true,
      requiresEmailVerification: true,
      email: user.email,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    return apiError(err);
  }
}
