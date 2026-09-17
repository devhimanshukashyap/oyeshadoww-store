import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { getBatchJobStatus } from "@/server/services/download.service";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const user = await requireUser();
    const job = await getBatchJobStatus({ userId: user.id, jobId: params.jobId });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      status: job.status,
      downloadUrl: (job as any).downloadUrl ?? null,
      error: job.error,
      reelCount: (job.reelIds as string[]).length,
    });
  } catch (err) {
    return apiError(err);
  }
}
