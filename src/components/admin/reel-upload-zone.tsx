"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, RefreshCcw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/upload-client";

interface FileTask {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

const MAX_VIDEO_MB = 500;

export function ReelUploadZone({ productId, onReelUploaded }: { productId: string; onReelUploaded: () => void }) {
  const [variant, setVariant] = useState<"reel-watermarked" | "reel-clean">("reel-watermarked");
  const [tasks, setTasks] = useState<FileTask[]>([]);

  const runUpload = useCallback(
    async (task: FileTask) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "uploading", error: undefined } : t)));

      const title = task.file.name.replace(/\.[^/.]+$/, "");
      const result = await uploadFile({
        file: task.file,
        productId,
        kind: variant,
        newReelTitle: title,
        onProgress: (pct) => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))),
      });

      if (result.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "done", progress: 100 } : t)));
        onReelUploaded();
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "error", error: result.error } : t)));
      }
    },
    [productId, variant, onReelUploaded]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newTasks: FileTask[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: "queued",
      }));
      setTasks((prev) => [...prev, ...newTasks]);
      // Sequential upload keeps this predictable and avoids saturating the
      // admin's upload bandwidth with many large videos at once.
      (async () => {
        for (const task of newTasks) {
          await runUpload(task);
        }
      })();
    },
    [runUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/mp4": [".mp4"], "video/quicktime": [".mov"], "video/webm": [".webm"] },
    maxSize: MAX_VIDEO_MB * 1024 * 1024,
  });

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">Add reels</h3>
        <select value={variant} onChange={(e) => setVariant(e.target.value as any)} className="input w-auto py-2 text-sm">
          <option value="reel-watermarked">Uploading: Watermarked</option>
          <option value="reel-clean">Uploading: Non-watermarked</option>
        </select>
      </div>

      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud size={28} className="text-ink-faint" />
        <p className="text-sm text-ink">Drag & drop reel files here, or tap to choose</p>
        <p className="text-xs text-ink-faint">MP4, MOV, WebM · up to {MAX_VIDEO_MB}MB each · multiple files supported</p>
      </div>

      {tasks.length > 0 && (
        <ul className="mt-4 space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{task.file.name}</p>
                {task.status === "uploading" && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
                  </div>
                )}
                {task.status === "error" && <p className="mt-0.5 text-xs text-danger">{task.error}</p>}
              </div>
              {task.status === "uploading" && <Loader2 size={16} className="shrink-0 animate-spin text-accent" />}
              {task.status === "done" && <CheckCircle2 size={16} className="shrink-0 text-success" />}
              {task.status === "error" && (
                <button onClick={() => runUpload(task)} className="btn-ghost shrink-0 px-2 py-1 text-xs">
                  <RefreshCcw size={14} /> Retry
                </button>
              )}
              {task.status === "queued" && <XCircle size={16} className="shrink-0 text-ink-faint" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
