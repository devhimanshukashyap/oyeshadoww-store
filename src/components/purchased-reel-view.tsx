"use client";

import { useState } from "react";
import type { Variant } from "@prisma/client";
import { ReelList } from "@/components/reel-list";

interface Reel {
  id: string;
  title: string;
  description?: string | null;
  thumbnailKey?: string | null;
  durationSec?: number | null;
}

export function PurchasedReelView({
  productId,
  ownedVariants,
  reels,
}: {
  productId: string;
  ownedVariants: Variant[];
  reels: Reel[];
}) {
  const [variant, setVariant] = useState<Variant>(
    ownedVariants.includes("CLEAN") ? "CLEAN" : "WATERMARKED"
  );

  return (
    <div>
      {ownedVariants.length > 1 && (
        <div className="mb-6 flex rounded-lg border border-border bg-surface-raised p-1">
          <button
            type="button"
            onClick={() => setVariant("WATERMARKED")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              variant === "WATERMARKED"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Watermarked
          </button>

          <button
            type="button"
            onClick={() => setVariant("CLEAN")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              variant === "CLEAN"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Non-watermarked
          </button>
        </div>
      )}

      <ReelList
        productId={productId}
        variant={variant}
        reels={reels}
      />
    </div>
  );
}