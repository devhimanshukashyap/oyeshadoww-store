import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { singleDownloadSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { getSingleDownloadUrl } from "@/server/services/download.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const MAX = Number(process.env.RATE_LIMIT_DOWNLOAD_MAX ?? 60);
const WINDOW = Number(process.env.RATE_LIMIT_DOWNLOAD_WINDOW_SECONDS ?? 600);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = getClientIp(req.headers);

    const limit = rateLimit(`download:${user.id}`, MAX, WINDOW);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many downloads. Please slow down." }, { status: 429 });
    }

    const body = singleDownloadSchema.parse(await req.json());

    const result = await getSingleDownloadUrl({
      userId: user.id,
      reelId: body.reelId,
      intent: body.intent,
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    if (!result.ok) {
      const status = result.reason === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: "You don't have access to this file." }, { status });
    }

    return NextResponse.json({ url: result.url, expiresInSeconds: result.expiresInSeconds });
  } catch (err) {
    return apiError(err);
  }
}
