import archiver from "archiver";
import { PassThrough } from "stream";
import { Upload } from "@aws-sdk/lib-storage";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  buildArchiveKey,
  createDownloadUrl,
  deleteObject,
  getBucketName,
  getObjectStream,
  getR2Client,
} from "@/lib/r2";
import { resolveBatchAccess, resolveReelAccess } from "@/server/services/entitlement.service";
import type { Variant } from "@prisma/client";

const BATCH_URL_TTL = Number(process.env.R2_BATCH_URL_TTL_SECONDS ?? 900);

export interface DownloadLogInput {
  userId: string;
  productId: string;
  reelId?: string;
  variant: Variant;
  action: "SINGLE" | "BATCH";
  success: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

export async function logDownload(input: DownloadLogInput) {
  await db.downloadLog.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      reelId: input.reelId,
      variant: input.variant,
      action: input.action,
      success: input.success,
      reason: input.reason,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}

/**
 * Single-reel download: verifies ownership (via entitlement service),
 * logs the attempt, and — only if authorized — mints a short-lived signed
 * URL. Nothing here ever returns a permanent link.
 */
export async function getSingleDownloadUrl(params: {
  userId: string;
  reelId: string;
  variant?: Variant;
  intent?: "preview" | "download";
  ip?: string;
  userAgent?: string;
}) {
  const access = await resolveReelAccess({
    userId: params.userId,
    reelId: params.reelId,
    requestedVariant: params.variant,
  });

  if (!access.authorized) {
    await logDownload({
      userId: params.userId,
      productId: "unknown",
      reelId: params.reelId,
      variant: params.variant ?? "WATERMARKED",
      action: "SINGLE",
      success: false,
      reason: access.reason,
      ip: params.ip,
      userAgent: params.userAgent,
    });
    return { ok: false as const, reason: access.reason };
  }

  const url = await createDownloadUrl({
    key: access.storageObject.key,
    // Preview streams inline (no attachment header); download forces a save-as.
    filename:
      params.intent === "preview"
        ? undefined
        : `${access.reel.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "reel"}.mp4`,
  });

  await logDownload({
    userId: params.userId,
    productId: access.reel.productId,
    reelId: access.reel.id,
    variant: access.variant,
    action: "SINGLE",
    success: true,
    ip: params.ip,
    userAgent: params.userAgent,
  });

  return { ok: true as const, url, expiresInSeconds: Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 300) };
}

/**
 * Creates a BatchDownloadJob row after validating every requested reel is
 * owned by the user, then kicks off ZIP generation without blocking the
 * HTTP response (fire-and-forget on the Node process; the client polls
 * job status). For a multi-instance production deployment with heavy
 * batch traffic, swap this trigger for a real queue (BullMQ/SQS) — the
 * processBatchJob() function below is already a self-contained unit of
 * work that a queue worker could call directly.
 */
export async function createBatchJob(params: {
  userId: string;
  productId: string;
  variant: Variant;
  reelIds: string[];
}) {
  const access = await resolveBatchAccess({
    userId: params.userId,
    productId: params.productId,
    variant: params.variant,
    reelIds: params.reelIds,
  });

  if (!access.authorized) {
    await logDownload({
      userId: params.userId,
      productId: params.productId,
      variant: "WATERMARKED",
      action: "BATCH",
      success: false,
      reason: access.reason,
    });
    return { ok: false as const, reason: access.reason, missing: (access as any).missing };
  }

  const job = await db.batchDownloadJob.create({
    data: {
      userId: params.userId,
      productId: params.productId,
      reelIds: access.reels.map((r) => r.id),
      variant: access.variant,
      status: "PENDING",
    },
  });

  // Fire-and-forget: do not await. Errors are captured inside and written
  // to the job row so the client's polling picks them up.
  processBatchJob(job.id).catch((err) => {
    logger.error("batch.process_uncaught", { jobId: job.id, error: String(err) });
  });

  return { ok: true as const, jobId: job.id };
}

export async function getBatchJobStatus(params: { userId: string; jobId: string }) {
  const job = await db.batchDownloadJob.findFirst({
    where: { id: params.jobId, userId: params.userId },
  });
  if (!job) return null;

  if (job.status === "READY" && job.archiveKey) {
    if (job.expiresAt && job.expiresAt < new Date()) {
      return { ...job, status: "EXPIRED" as const, downloadUrl: null };
    }
    const downloadUrl = await createDownloadUrl({
      key: job.archiveKey,
      filename: "reels.zip",
      expiresInSeconds: BATCH_URL_TTL,
    });
    return { ...job, downloadUrl };
  }

  return { ...job, downloadUrl: null };
}

/**
 * Streams each authorized reel out of R2 straight into a ZIP that is
 * streamed back into R2 via a multipart upload — the server never buffers
 * whole video files in memory, which keeps this safe for large batches.
 */
export async function processBatchJob(jobId: string) {
  const job = await db.batchDownloadJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  await db.batchDownloadJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

  try {
    const reelIds = job.reelIds as string[];
    const reels = await db.reel.findMany({
      where: { id: { in: reelIds } },
      include: { watermarkedObject: true, cleanObject: true },
    });

    const archiveKey = buildArchiveKey(job.id);
    const archive = archiver("zip", { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    const upload = new Upload({
      client: getR2Client(),
      params: {
        Bucket: getBucketName(),
        Key: archiveKey,
        Body: passthrough,
        ContentType: "application/zip",
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    });

    const uploadPromise = upload.done();

    let index = 1;
    for (const reel of reels) {
      const storageObject = job.variant === "CLEAN" ? reel.cleanObject : reel.watermarkedObject;
      if (!storageObject || storageObject.status !== "READY") continue;
      const stream = await getObjectStream(storageObject.key);
      const safeName = `${String(index).padStart(2, "0")}-${reel.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "reel"}.mp4`;
      archive.append(stream as any, { name: safeName });
      index += 1;
    }

    await archive.finalize();
    await uploadPromise;

    const expiresAt = new Date(Date.now() + BATCH_URL_TTL * 1000);

    await db.batchDownloadJob.update({
      where: { id: jobId },
      data: { status: "READY", archiveKey, expiresAt },
    });

    await logDownload({
      userId: job.userId,
      productId: job.productId,
      variant: job.variant,
      action: "BATCH",
      success: true,
    });

    logger.info("batch.ready", { jobId, reelCount: reels.length });
  } catch (err) {
    logger.error("batch.failed", { jobId, error: String(err) });
    await db.batchDownloadJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: "Archive generation failed. Please try again." },
    });
    await logDownload({
      userId: job.userId,
      productId: job.productId,
      variant: job.variant,
      action: "BATCH",
      success: false,
      reason: "ARCHIVE_FAILED",
    });
  }
}

/** Deletes expired temporary archives from R2 and marks jobs EXPIRED. Run on a schedule (see scripts/cleanup-archives.ts). */
export async function cleanupExpiredArchives() {
  const expired = await db.batchDownloadJob.findMany({
    where: { status: "READY", expiresAt: { lt: new Date() } },
  });

  for (const job of expired) {
    if (job.archiveKey) {
      await deleteObject(job.archiveKey).catch((err) =>
        logger.warn("batch.cleanup_delete_failed", { jobId: job.id, error: String(err) })
      );
    }
    await db.batchDownloadJob.update({ where: { id: job.id }, data: { status: "EXPIRED" } });
  }

  logger.info("batch.cleanup_done", { count: expired.length });
  return expired.length;
}
