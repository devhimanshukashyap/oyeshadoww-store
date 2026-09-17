"use client";

import { useRef, useState } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2, Eye, EyeOff, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { uploadFile } from "@/lib/upload-client";

export interface ReelRowData {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  visibility: "VISIBLE" | "HIDDEN";
  thumbnailKey: string | null;
  watermarkedReady: boolean;
  cleanReady: boolean;
}

export function ReelManager({ productId, initialReels }: { productId: string; initialReels: ReelRowData[] }) {
  const [reels, setReels] = useState(
    [...initialReels].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= reels.length) return;
    const next = [...reels];
    [next[index], next[target]] = [next[target], next[index]];
    setReels(next);
    void fetch("/api/admin/reels/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        order: next.map((r, i) => ({ reelId: r.id, sortOrder: i })),
      }),
    });
  }

  async function toggleVisibility(reel: ReelRowData) {
    const next = reel.visibility === "VISIBLE" ? "HIDDEN" : "VISIBLE";
    setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, visibility: next } : r)));
    await fetch(`/api/admin/reels/${reel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
  }

  async function rename(reel: ReelRowData, title: string, description: string) {
    setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, title, description } : r)));
    await fetch(`/api/admin/reels/${reel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
  }

  async function remove(reel: ReelRowData) {
    if (!confirm(`Remove "${reel.title}" from this bundle? Customers who already own it keep their access.`)) return;
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    await fetch(`/api/admin/reels/${reel.id}`, { method: "DELETE" });
  }

  function markReady(reelId: string, kind: "watermarkedReady" | "cleanReady") {
    setReels((prev) => prev.map((r) => (r.id === reelId ? { ...r, [kind]: true } : r)));
  }

  if (reels.length === 0) {
    return <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-ink-muted">No reels yet — add some above.</p>;
  }

  return (
    <ul className="space-y-2">
      {reels.map((reel, index) => (
        <ReelRow
          key={reel.id}
          reel={reel}
          productId={productId}
          isFirst={index === 0}
          isLast={index === reels.length - 1}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onToggleVisibility={() => toggleVisibility(reel)}
          onRename={rename}
          onRemove={() => remove(reel)}
          onFileReady={markReady}
        />
      ))}
    </ul>
  );
}

function ReelRow({
  reel,
  productId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onRename,
  onRemove,
  onFileReady,
}: {
  reel: ReelRowData;
  productId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onRename: (reel: ReelRowData, title: string, description: string) => void;
  onRemove: () => void;
  onFileReady: (reelId: string, kind: "watermarkedReady" | "cleanReady") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reel.title);
  const [description, setDescription] = useState(reel.description ?? "");
  const watermarkedInput = useRef<HTMLInputElement>(null);
  const cleanInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"watermarked" | "clean" | null>(null);

  async function handleReplace(kind: "reel-watermarked" | "reel-clean", file: File) {
    setUploading(kind === "reel-watermarked" ? "watermarked" : "clean");
    const result = await uploadFile({ file, productId, kind, reelId: reel.id });
    setUploading(null);
    if (result.ok) onFileReady(reel.id, kind === "reel-watermarked" ? "watermarkedReady" : "cleanReady");
    else alert(result.error ?? "Upload failed");
  }

  return (
    <li className="card p-3">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <button onClick={onMoveUp} disabled={isFirst} className="rounded p-1 text-ink-faint hover:bg-surface-raised disabled:opacity-30">
            <ArrowUp size={14} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="rounded p-1 text-ink-faint hover:bg-surface-raised disabled:opacity-30">
            <ArrowDown size={14} />
          </button>
        </div>

        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface-raised">
          {reel.thumbnailKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/reel-thumbnail?key=${encodeURIComponent(reel.thumbnailKey)}`} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input py-1.5 text-sm" />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="input py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onRename(reel, title, description);
                    setEditing(false);
                  }}
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-ink">{reel.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <FileBadge label="Watermarked" ready={reel.watermarkedReady} />
                <FileBadge label="Clean" ready={reel.cleanReady} />
                {reel.visibility === "HIDDEN" && (
                  <span className="rounded-pill bg-ink-faint/15 px-2 py-0.5 text-[10px] text-ink-faint">Hidden</span>
                )}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button onClick={() => setEditing(true)} className="btn-ghost px-2 py-1.5 text-xs">
              <Pencil size={14} />
            </button>
            <button onClick={onToggleVisibility} className="btn-ghost px-2 py-1.5 text-xs">
              {reel.visibility === "VISIBLE" ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <input
              ref={watermarkedInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleReplace("reel-watermarked", e.target.files[0])}
            />
            <button onClick={() => watermarkedInput.current?.click()} className="btn-ghost px-2 py-1.5 text-xs" title="Upload/replace watermarked file">
              {uploading === "watermarked" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              WM
            </button>

            <input
              ref={cleanInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleReplace("reel-clean", e.target.files[0])}
            />
            <button onClick={() => cleanInput.current?.click()} className="btn-ghost px-2 py-1.5 text-xs" title="Upload/replace clean file">
              {uploading === "clean" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Clean
            </button>

            <button onClick={onRemove} className="btn-ghost px-2 py-1.5 text-xs text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function FileBadge({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] ${
        ready ? "bg-success/15 text-success" : "bg-ink-faint/15 text-ink-faint"
      }`}
    >
      {ready ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}
