"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Film, Upload, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/upload-client";

export function ProductAssetUpload({
  productId,
  thumbnailKey,
  previewVideoKey,
}: {
  productId: string;
  thumbnailKey: string | null;
  previewVideoKey: string | null;
}) {
  const router = useRouter();
  const thumbInput = useRef<HTMLInputElement>(null);
  const previewInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"thumbnail" | "preview" | null>(null);

  async function handleUpload(kind: "thumbnail" | "preview", file: File) {
    setUploading(kind);
    const result = await uploadFile({ file, productId, kind });
    setUploading(null);
    if (result.ok) router.refresh();
    else alert(result.error ?? "Upload failed");
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-base font-semibold text-ink">Thumbnail & preview</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Thumbnail image</p>
          <div className="aspect-[9/13] w-full max-w-[140px] overflow-hidden rounded-lg bg-surface-raised">
            {thumbnailKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/admin/media/thumbnail?key=${encodeURIComponent(thumbnailKey)}`} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <input
            ref={thumbInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload("thumbnail", e.target.files[0])}
          />
          <button onClick={() => thumbInput.current?.click()} className="btn-secondary mt-2 px-3 py-2 text-xs">
            {uploading === "thumbnail" ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            {thumbnailKey ? "Replace" : "Upload"}
          </button>
        </div>

        <div>
          <p className="label">Preview clip (teaser)</p>
          <div className="aspect-[9/13] w-full max-w-[140px] overflow-hidden rounded-lg bg-surface-raised">
            {previewVideoKey ? (
              <video
                className="h-full w-full object-cover"
                controls
                preload="none"
                poster={
                  thumbnailKey
                    ? `/api/admin/media/thumbnail?key=${encodeURIComponent(
                      thumbnailKey
                    )}`
                    : undefined
                }
              >
                <source
                  src={`/api/admin/media/preview?key=${encodeURIComponent(
                    previewVideoKey
                  )}`}
                />
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-faint">
                <Upload size={20} />
              </div>
            )}
          </div>
          <input
            ref={previewInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload("preview", e.target.files[0])}
          />
          <button onClick={() => previewInput.current?.click()} className="btn-secondary mt-2 px-3 py-2 text-xs">
            {uploading === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
            {previewVideoKey ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
