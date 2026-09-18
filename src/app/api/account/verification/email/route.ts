import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createVerificationChallenge } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

class BadRequestError extends Error {
    status = 400;
}

export async function POST(req: NextRequest) {
    try {
        const sessionUser = await requireUser();

        const user = await db.user.findUnique({
            where: { id: sessionUser.id },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerifiedAt: true,
            },
        });

        if (!user) {
            throw new Error("User account not found");
        }

        const ip = getClientIp(req.headers);

        const ipLimit = rateLimit(`verify-email-ip:${ip}`, 5, 600);
        const userLimit = rateLimit(`verify-email:${user.id}:${ip}`, 5, 600);

        if (!ipLimit.allowed || !userLimit.allowed) {
            return NextResponse.json(
                { error: "Too many attempts. Try again later." },
                { status: 429 }
            );
        }

        if (user.emailVerifiedAt) {
            throw new BadRequestError("Email is already verified.");
        }

        const challenge = await createVerificationChallenge({
            userId: user.id,
            type: "EMAIL",
            target: user.email,
        });

        const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://oyeshadoww.com";

        await sendEmail({
            to: user.email,
            subject: "Verify your email",
            text: `Your Oye Shadoww verification code is ${challenge.code}. It expires in 10 minutes.`,
            html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
          <h2 style="margin:0 0 12px">Verify your email</h2>
          <p>Hi ${escapeHtml(user.name ?? "there")},</p>
          <p>Use this verification code to verify your Oye Shadoww account:</p>

          <div style="margin:24px 0;padding:18px;text-align:center;background:#f5f5f5;border-radius:10px">
            <strong style="font-size:30px;letter-spacing:8px">${challenge.code}</strong>
          </div>

          <p>This code expires in 10 minutes.</p>
          <p style="color:#666;font-size:13px">
            If you didn't request this code, you can safely ignore this email.
          </p>

          <p style="color:#999;font-size:12px;margin-top:24px">
            ${escapeHtml(siteUrl)}
          </p>
        </div>
      `,
        });

        return NextResponse.json({
            ok: true,
            challengeId: challenge.challengeId,
            expiresAt: challenge.expiresAt,
        });
    } catch (err) {
        return apiError(err);
    }
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}