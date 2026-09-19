import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

/**
 * Cloudflare R2 storage layer.
 *
 * R2 is S3-compatible, so we use the standard AWS SDK v3 clients pointed at
 * R2's endpoint. THE BUCKET MUST BE PRIVATE (no public access / no public
 * dev URL enabled) — see docs/DEPLOYMENT.md "Cloudflare R2 Setup". Every
 * file is fetched only via short-lived presigned URLs generated here,
 * never a permanent public link.
 *
 * Object key layout:
 *   products/{productId}/reels/{reelId}/watermarked/{filename}
 *   products/{productId}/reels/{reelId}/clean/{filename}
 *   products/{productId}/thumbnail/{filename}
 *   products/{productId}/preview/{filename}
 *   tmp-archives/{jobId}.zip
 *
 * Business logic (who owns what) is never inferred from the key itself —
 * only the database (StorageObject / Reel / Purchase tables) is
 * authoritative. The key layout is just for human-readable organization.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: getEndpoint(),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export function getBucketName(): string {
  return requiredEnv("R2_BUCKET_NAME");
}

// --- Key builders -----------------------------------------------------------

function sanitizeFilename(name: string): string {
  // Strip path separators and anything that isn't a safe filename char to
  // prevent path traversal (../../etc) or key-injection via a crafted
  // upload filename.
  const base = name.split("/").pop()?.split("\\").pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150) || "file";
}

export function buildReelKey(
  productId: string,
  reelId: string,
  variant: "watermarked" | "clean",
  filename: string
): string {
  return `products/${productId}/reels/${reelId}/${variant}/${sanitizeFilename(filename)}`;
}

export function buildReelThumbnailKey(
  productId: string,
  reelId: string
): string {
  return `products/${productId}/reels/${reelId}/thumbnail/first-frame.webp`;
}

export function buildProductAssetKey(
  productId: string,
  kind: "thumbnail" | "preview",
  filename: string
): string {
  return `products/${productId}/${kind}/${nanoid(8)}-${sanitizeFilename(filename)}`;
}

export function buildArchiveKey(jobId: string): string {
  return `tmp-archives/${jobId}.zip`;
}

// --- Presigned operations -----------------------------------------------------

/**
 * Presigned PUT URL so large video files upload directly from the admin's
 * browser straight to R2 (never proxied through our own server, which
 * would be slow and memory-hungry). The server still writes the
 * StorageObject row and validates content-type/size before/after.
 */
export async function createUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: params.key,
    ContentType: params.contentType,
  });
  return getSignedUrl(getR2Client(), cmd, { expiresIn: params.expiresInSeconds ?? 600 });
}

/** Short-lived signed download URL. This is the ONLY way a file ever leaves R2. */
export async function createDownloadUrl(params: {
  key: string;
  filename?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: params.key,
    ResponseContentDisposition: params.filename
      ? `attachment; filename="${sanitizeFilename(params.filename)}"`
      : undefined,
  });
  const ttl =
    params.expiresInSeconds ?? Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 300);
  return getSignedUrl(getR2Client(), cmd, { expiresIn: ttl });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: getBucketName(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

export async function getObjectBuffer(key: string): Promise<{ body: Uint8Array; contentType?: string }> {
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
  const body = await res.Body?.transformToByteArray();
  if (!body) throw new Error(`Empty object body for key ${key}`);
  return { body, contentType: res.ContentType };
}

export async function putObjectBuffer(params: {
  key: string;
  body: Uint8Array | Buffer;
  contentType?: string;
}): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

/** Returns a readable stream for large objects — used by the zip pipeline so we never buffer a whole video in memory. */
export async function getObjectStream(key: string) {
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
  if (!res.Body) throw new Error(`Empty object body for key ${key}`);
  return res.Body as NodeJS.ReadableStream;
}

export const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB per reel, generous for short-form vertical video
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
