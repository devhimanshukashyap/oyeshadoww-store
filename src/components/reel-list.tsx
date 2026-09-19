"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Download, Loader2, CheckSquare, Square, PackageCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Variant } from "@prisma/client";

interface Reel {
  id: string;
  title: string;
  description?: string | null;
  thumbnailKey?: string | null;
  durationSec?: number | null;
}

type BatchState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "processing" }
  | { phase: "ready"; url: string }
  | { phase: "error"; message: string };

export function ReelList({
  productId,
  variant,
  reels,
}: {
  productId: string;
  variant: Variant;
  reels: Reel[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState>({ phase: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const allSelected = reels.length > 0 && selected.size === reels.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(reels.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePreview(reelId: string) {
    if (previewId === reelId) {
      setPreviewId(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewId(reelId);
    setPreviewUrl(null);
    const res = await fetch("/api/download/reel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId, variant, intent: "preview" }),
    });
    const data = await res.json();
    if (res.ok) setPreviewUrl(data.url);
  }

  async function handleDownload(reelId: string) {
    setDownloadingId(reelId);
    try {
      const res = await fetch("/api/download/reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId, variant, intent: "download" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      window.location.href = data.url;
    } catch {
      // swallow — UI stays as-is, user can retry
    } finally {
      setDownloadingId(null);
    }
  }

  const startBatch = useCallback(async () => {
    if (selected.size === 0) return;
    setBatch({ phase: "starting" });

    try {
      const res = await fetch("/api/download/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variant,
          reelIds: [...selected],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start download");

      setBatch({ phase: "processing" });

      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/download/batch/${data.jobId}`);
        const statusData = await statusRes.json();

        if (statusData.status === "READY" && statusData.downloadUrl) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatch({ phase: "ready", url: statusData.downloadUrl });
        } else if (statusData.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatch({ phase: "error", message: statusData.error ?? "Archive generation failed." });
        } else if (statusData.status === "EXPIRED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatch({ phase: "error", message: "This download expired. Please try again." });
        }
      }, 2500);
    } catch (err: any) {
      setBatch({ phase: "error", message: err.message ?? "Could not start download." });
    }
  }, [productId, selected, variant]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={toggleAll} className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          {allSelected ? <CheckSquare size={18} className="text-accent" /> : <Square size={18} />}
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        <button
          onClick={startBatch}
          disabled={selected.size === 0 || batch.phase === "starting" || batch.phase === "processing"}
          className="btn-primary"
        >
          {batch.phase === "starting" || batch.phase === "processing" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PackageCheck size={16} />
          )}
          Download Selected ({selected.size})
        </button>
      </div>

      <BatchStatusBanner batch={batch} onDismiss={() => setBatch({ phase: "idle" })} />

      <ul className="space-y-2">
        {reels.map((reel) => (
          <li key={reel.id} className="card p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleOne(reel.id)}
                aria-label={selected.has(reel.id) ? `Deselect ${reel.title}` : `Select ${reel.title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-raised"
              >
                {selected.has(reel.id) ? <CheckSquare size={20} className="text-accent" /> : <Square size={20} />}
              </button>

              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface-raised">
                {reel.thumbnailKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/reel-thumbnail?key=${encodeURIComponent(reel.thumbnailKey)}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{reel.title}</p>
                {reel.durationSec != null && (
                  <p className="text-xs text-ink-faint">{Math.round(reel.durationSec)}s</p>
                )}
              </div>

              <button onClick={() => handlePreview(reel.id)} className="btn-ghost px-3 py-2 text-sm">
                <Play size={14} />
                <span className="hidden sm:inline">Preview</span>
              </button>
              <button
                onClick={() => handleDownload(reel.id)}
                disabled={downloadingId === reel.id}
                className="btn-secondary px-3 py-2 text-sm"
              >
                {downloadingId === reel.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>

            {previewId === reel.id && (
              <div className="mt-3 aspect-[9/16] max-w-[220px] overflow-hidden rounded-lg bg-black">
                {previewUrl ? (
                  <video src={previewUrl} controls autoPlay className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-faint">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BatchStatusBanner({ batch, onDismiss }: { batch: BatchState; onDismiss: () => void }) {
  if (batch.phase === "idle") return null;

  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-3 rounded-card border p-4 text-sm",
        batch.phase === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-border bg-surface-raised text-ink"
      )}
    >
      <div className="flex items-center gap-2">
        {(batch.phase === "starting" || batch.phase === "processing") && (
          <>
            <Loader2 size={16} className="animate-spin" />
            {batch.phase === "starting" ? "Preparing your download…" : "Generating ZIP…"}
          </>
        )}
        {batch.phase === "ready" && (
          <>
            <PackageCheck size={16} className="text-success" />
            Your download is ready.
          </>
        )}
        {batch.phase === "error" && batch.message}
      </div>

      <div className="flex items-center gap-2">
        {batch.phase === "ready" && (
          <a href={batch.url} className="btn-primary px-4 py-2 text-sm">
            Download ZIP
          </a>
        )}
        <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-faint hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
