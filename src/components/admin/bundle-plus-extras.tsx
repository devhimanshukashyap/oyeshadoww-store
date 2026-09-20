"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadFile } from "@/lib/upload-client";

type Extra = {
  id: string;
  type: "TEXT" | "FILE";
  title: string;
  description: string | null;
  content: string | null;
  sortOrder: number;
  fileName: string | null;
  fileContentType?: string | null;
  fileSizeBytes?: string | number | null;
};

export function BundlePlusExtras({
  productId,
  initialExtras,
}: {
  productId: string;
  initialExtras: Extra[];
}) {
  const router = useRouter();

  const [extras, setExtras] = useState(initialExtras);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [extraType, setExtraType] = useState<"TEXT" | "FILE">("TEXT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setContent("");
    setSortOrder(extras.length);
    setExtraType("TEXT");
    setSelectedFile(null);
    setUploadProgress(0);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError(null);
    setUploadProgress(0);

    try {
      let storageObjectId: string | null = null;
      let uploadedFileName: string | null = null;
      let uploadedFileContentType: string | null = null;
      let uploadedFileSizeBytes: number | null = null;

      if (extraType === "FILE") {
        if (!selectedFile) {
          setError("Please select a file.");
          return;
        }

        const upload = await uploadFile({
          file: selectedFile,
          productId,
          kind: "bundle-plus-extra",
          onProgress: setUploadProgress,
        });

        if (!upload.ok || !upload.storageObjectId) {
          setError(upload.error ?? "Could not upload the file.");
          return;
        }

        storageObjectId = upload.storageObjectId;
        uploadedFileName = selectedFile.name;
        uploadedFileContentType = selectedFile.type;
        uploadedFileSizeBytes = selectedFile.size;
      }

      const res = await fetch(`/api/admin/products/${productId}/extras`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: extraType,
          title,
          description: description || null,
          content: extraType === "TEXT" ? content : null,
          storageObjectId,
          fileName: uploadedFileName,
          fileContentType: uploadedFileContentType,
          fileSizeBytes: uploadedFileSizeBytes,
          sortOrder,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not create extra.");
        return;
      }

      setExtras((current) => [...current, data.extra]);
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(extraId: string) {
    if (!confirm("Delete this Bundle+ extra?")) return;

    const res = await fetch(
      `/api/admin/products/${productId}/extras/${extraId}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete extra.");
      return;
    }

    setExtras((current) => current.filter((extra) => extra.id !== extraId));
    router.refresh();
  }

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            Bundle+ Extras
            {extras.length > 0 && (
              <span className="ml-2 text-ink-faint">({extras.length})</span>
            )}
          </h2>

          <p className="mt-1 text-sm text-ink-muted">
            Premium content available to Bundle+ buyers.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-secondary shrink-0 px-3 py-2 text-xs"
          >
            <Plus size={14} />
            Add extra
          </button>
        )}
      </div>

      {extras.length > 0 && (
        <div className="space-y-3">
          {extras.map((extra) => (
            <div
              key={extra.id}
              className="rounded-lg border border-border bg-surface-raised p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-ink">{extra.title}</h3>

                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                      {extra.type === "TEXT" ? "Text" : "File"}
                    </span>
                  </div>

                  {extra.description && (
                    <p className="mt-1 text-sm text-ink-muted">
                      {extra.description}
                    </p>
                  )}

                  {extra.type === "TEXT" && extra.content && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-ink">
                      {extra.content}
                    </p>
                  )}

                  {extra.type === "FILE" && extra.fileName && (
                    <p className="mt-3 text-sm text-ink-muted">
                      File: {extra.fileName}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(extra.id)}
                  className="shrink-0 rounded-md p-2 text-danger hover:bg-danger/10"
                  title="Delete extra"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {extras.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-ink-muted">
            No Bundle+ extras added yet.
          </p>

          <p className="mt-1 text-xs text-ink-faint">
            Add prompts, ideas, captions, tips, files, or other premium
            content.
          </p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-border bg-surface-raised p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Add Bundle+ extra
            </h3>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="text-xs text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="label">Type</label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setExtraType("TEXT");
                  setSelectedFile(null);
                  setUploadProgress(0);

                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  extraType === "TEXT"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                Text
              </button>

              <button
                type="button"
                onClick={() => {
                  setExtraType("FILE");
                  setContent("");
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  extraType === "FILE"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                File / PDF
              </button>
            </div>
          </div>

          <div>
            <label className="label">Title</label>

            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="AI Snake prompts"
            />
          </div>

          <div>
            <label className="label">
              Short description (optional)
            </label>

            <input
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="The prompts used to create these reels"
            />
          </div>

          {extraType === "TEXT" ? (
            <div>
              <label className="label">Content</label>

              <textarea
                required
                rows={8}
                maxLength={50000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input"
                placeholder="Paste your prompts, ideas, captions, tips, etc."
              />
            </div>
          ) : (
            <div>
              <label className="label">File</label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.zip,application/pdf,text/plain,application/zip"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null);
                  setUploadProgress(0);
                }}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              />

              <p className="mt-2 text-xs text-ink-faint">
                PDF, TXT or ZIP · Maximum 25 MB
              </p>

              {selectedFile && (
                <p className="mt-2 text-xs text-ink-muted">
                  {selectedFile.name} ·{" "}
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}

              {saving && extraType === "FILE" && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-ink-muted">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Sort order</label>

            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="input"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}

            {saving
              ? extraType === "FILE"
                ? "Uploading..."
                : "Saving..."
              : "Save extra"}
          </button>
        </form>
      )}
    </div>
  );
}