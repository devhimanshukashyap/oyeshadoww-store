"use client";

import { useRouter } from "next/navigation";
import { ReelUploadZone } from "@/components/admin/reel-upload-zone";
import { ReelManager, type ReelRowData } from "@/components/admin/reel-manager";

export function ProductReelsSection({ productId, initialReels }: { productId: string; initialReels: ReelRowData[] }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <ReelUploadZone productId={productId} onReelUploaded={() => router.refresh()} />
      {/* Remount when the set of reel ids changes (new upload / delete) so
          ReelManager's local state re-syncs with the freshly refreshed
          server data instead of going stale. */}
      <ReelManager key={initialReels.map((r) => r.id).join(",")} productId={productId} initialReels={initialReels} />
    </div>
  );
}
