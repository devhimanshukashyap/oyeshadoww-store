"use client";

import { useState } from "react";

export function BundlePlusExtraDownload({
  productId,
  extraId,
  fileName,
}: {
  productId: string;
  extraId: string;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/purchases/${productId}/extras/${extraId}/download`
      );

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Download failed");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Bundle+ extra download failed:", error);
      alert("Unable to download this file. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Preparing..." : "Download"}
    </button>
  );
}