import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { batchDownloadCreateSchema } from "@/lib/validation";
import { apiError } from "@/lib/api-error";
import { createBatchJob } from "@/server/services/download.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = getClientIp(req.headers);

    // Batch jobs are heavier than single downloads, so a tighter limit.
    const limit = rateLimit(`batch:${user.id}:${ip}`, 10, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many batch requests. Please wait a bit." }, { status: 429 });
    }

    const body = batchDownloadCreateSchema.parse(await req.json());

    const result = await createBatchJob({
      userId: user.id,
      productId: body.productId,
      reelIds: [...new Set(body.reelIds)], // de-dupe repeated selections
    });

    if (!result.ok) {
      const status = result.reason === "NOT_OWNED" ? 403 : 404;
      return NextResponse.json({ error: "You don't have access to one or more selected reels." }, { status });
    }

    return NextResponse.json({ jobId: result.jobId });
  } catch (err) {
    return apiError(err);
  }
}
