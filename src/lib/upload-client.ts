"use client";

/**
 * Drives the admin upload flow from the browser:
 *   1. POST /api/admin/uploads/presign -> validated presigned PUT URL
 *   2. PUT the file bytes straight to R2
 *   3. POST /api/admin/uploads/complete -> verifies + attaches the file
 *
 * Reel watermarked uploads additionally generate a first-frame thumbnail
 * in the browser and upload it directly to R2.
 */

export type UploadKind =
  | "reel-watermarked"
  | "reel-clean"
  | "reel-thumbnail"
  | "thumbnail"
  | "preview"
  | "bundle-plus-extra"
  | "hero-video";

export interface UploadResult {
  ok: boolean;
  reelId?: string;
  storageObjectId?: string;
  key?: string;
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
    // ------------------------------------------------------------
    // 1. Get presigned upload URL
    // ------------------------------------------------------------
    const presignRes = await fetch("/api/admin/uploads/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    if (!presignRes.ok) {
      return {
        ok: false,
        error: presignData.error ?? "Could not start upload",
      };
    }

    // ------------------------------------------------------------
    // 2. Upload original file directly to R2
    // ------------------------------------------------------------
    await putWithProgress(
      presignData.uploadUrl,
      params.file,
      params.onProgress
    );

    // ------------------------------------------------------------
    // 3. Complete original upload
    // ------------------------------------------------------------
    const completeRes = await fetch(
      "/api/admin/uploads/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storageObjectId: presignData.storageObjectId,
          productId: params.productId,
          kind: params.kind,
          reelId: params.reelId,
          newReelTitle: params.newReelTitle,
        }),
      }
    );

    const completeData = await completeRes.json();

    if (!completeRes.ok) {
      return {
        ok: false,
        error:
          completeData.error ??
          "Upload could not be finalized",
      };
    }

    // The complete endpoint creates a new Reel when this was
    // a brand-new upload, so use the returned ID. For an existing
    // reel replacement, fall back to the supplied reelId.
    const completedReelId =
      completeData.reelId ?? params.reelId;

    // ------------------------------------------------------------
    // 4. Generate first-frame thumbnail for watermarked reels
    // ------------------------------------------------------------
    if (
      params.kind === "reel-watermarked" &&
      completedReelId
    ) {
      try {
        const thumbnail =
          await generateFirstFrameThumbnail(params.file);

        // --------------------------------------------------------
        // 5. Get presigned URL for thumbnail
        // --------------------------------------------------------
        const thumbnailPresignRes = await fetch(
          "/api/admin/uploads/presign",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: params.productId,
              reelId: completedReelId,
              kind: "reel-thumbnail",
              filename: thumbnail.name,
              contentType: thumbnail.type,
              sizeBytes: thumbnail.size,
            }),
          }
        );

        const thumbnailPresignData =
          await thumbnailPresignRes.json();

        if (!thumbnailPresignRes.ok) {
          throw new Error(
            thumbnailPresignData.error ??
            "Could not prepare thumbnail upload"
          );
        }

        // --------------------------------------------------------
        // 6. Upload thumbnail directly to R2
        // --------------------------------------------------------
        await putWithProgress(
          thumbnailPresignData.uploadUrl,
          thumbnail
        );

        // --------------------------------------------------------
        // 7. Attach thumbnail to Reel
        // --------------------------------------------------------
        const thumbnailCompleteRes =
          await fetch(
            "/api/admin/uploads/complete",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                storageObjectId:
                  thumbnailPresignData.storageObjectId,
                productId: params.productId,
                kind: "reel-thumbnail",
                reelId: completedReelId,
              }),
            }
          );

        const thumbnailCompleteData =
          await thumbnailCompleteRes.json();

        if (!thumbnailCompleteRes.ok) {
          throw new Error(
            thumbnailCompleteData.error ??
            "Could not finalize thumbnail"
          );
        }
      } catch (thumbnailError) {
        // The actual reel upload already succeeded.
        // Thumbnail failure should not make the reel upload fail.
        console.warn(
          "Reel thumbnail generation failed:",
          thumbnailError
        );
      }
    }

    return {
      ok: true,
      reelId: completedReelId,
      storageObjectId: completeData.storageObjectId,
      key: completeData.key,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message ?? "Upload failed",
    };
  }
}

// -----------------------------------------------------------------------------
// Upload a file to R2 using a presigned URL
// -----------------------------------------------------------------------------

function putWithProgress(
  url: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);

    xhr.setRequestHeader(
      "Content-Type",
      file.type
    );

    xhr.upload.onprogress = (e) => {
      if (
        e.lengthComputable &&
        onProgress
      ) {
        onProgress(
          Math.round(
            (e.loaded / e.total) * 100
          )
        );
      }
    };

    xhr.onload = () => {
      if (
        xhr.status >= 200 &&
        xhr.status < 300
      ) {
        resolve();
      } else {
        reject(
          new Error(
            `Upload failed (${xhr.status})`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Network error during upload"
        )
      );
    };

    xhr.send(file);
  });
}

// -----------------------------------------------------------------------------
// Generate a thumbnail from the first useful frame of a video
// -----------------------------------------------------------------------------

async function generateFirstFrameThumbnail(
  file: File
): Promise<File> {
  const video =
    document.createElement("video");

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const objectUrl =
    URL.createObjectURL(file);

  try {
    video.src = objectUrl;

    await new Promise<void>(
      (resolve, reject) => {
        video.onloadeddata = () =>
          resolve();

        video.onerror = () =>
          reject(
            new Error(
              "Could not read video for thumbnail generation."
            )
          );
      }
    );

    // Use a frame just after the beginning rather than exactly 0s.
    // This avoids blank/black opening frames in some encoded videos.
    const targetTime = Math.min(
      0.1,
      Math.max(
        0,
        video.duration / 10 || 0
      )
    );

    video.currentTime = targetTime;

    await new Promise<void>(
      (resolve, reject) => {
        video.onseeked = () =>
          resolve();

        video.onerror = () =>
          reject(
            new Error(
              "Could not seek video for thumbnail generation."
            )
          );
      }
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Could not create thumbnail canvas."
      );
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/webp",
            0.82
          )
      );

    if (!blob) {
      throw new Error(
        "Could not generate thumbnail image."
      );
    }

    const baseName =
      file.name.replace(
        /\.[^.]+$/,
        ""
      );

    return new File(
      [blob],
      `${baseName}-first-frame.webp`,
      {
        type: "image/webp",
      }
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.remove();
  }
}