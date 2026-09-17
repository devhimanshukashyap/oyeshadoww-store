"use client";

/**
 * Drives the three-step admin upload flow from the browser:
 *   1. POST /api/admin/uploads/presign  -> validated presigned PUT URL
 *   2. PUT the file bytes straight to R2 (progress tracked via XHR)
 *   3. POST /api/admin/uploads/complete -> verifies + attaches the file
 *
 * Used by both the reel uploader (video files) and the product
 * thumbnail/preview uploader (image/video assets).
 */

export type UploadKind = "reel-watermarked" | "reel-clean" | "thumbnail" | "preview";

export interface UploadResult {
  ok: boolean;
  reelId?: string;
  error?: string;
}

export async function uploadFile(params: {
  file: File;
  productId: string;
  kind: UploadKind;
  reelId?: string;
  newReelTitle?: string;
  onProgress?: (pct: number) => void;
}): Promise<UploadResult> {
  try {
    const presignRes = await fetch("/api/admin/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: params.productId,
        reelId: params.reelId,
        kind: params.kind,
        filename: params.file.name,
        contentType: params.file.type,
        sizeBytes: params.file.size,
      }),
    });
    const presignData = await presignRes.json();
    if (!presignRes.ok) return { ok: false, error: presignData.error ?? "Could not start upload" };

    await putWithProgress(presignData.uploadUrl, params.file, params.onProgress);

    const completeRes = await fetch("/api/admin/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageObjectId: presignData.storageObjectId,
        productId: params.productId,
        kind: params.kind,
        reelId: params.reelId,
        newReelTitle: params.newReelTitle,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) return { ok: false, error: completeData.error ?? "Upload could not be finalized" };

    return { ok: true, reelId: completeData.reelId };
  } catch (err: any) {
    return { ok: false, error: err.message ?? "Upload failed" };
  }
}

function putWithProgress(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
