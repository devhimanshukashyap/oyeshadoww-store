import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPurchasedProductDetail } from "@/server/services/product.service";
import { ReelList } from "@/components/reel-list";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Your bundle" };
export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: { productId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=/purchases/${params.productId}`);

  // Ownership is re-verified here, server-side, against the Purchase/Order
  // tables — never inferred from the URL alone. If the lookup returns
  // null (not owned, or order not paid), we 404 rather than reveal
  // whether the product exists.
  const detail = await getPurchasedProductDetail(user.id, params.productId);
  if (!detail) notFound();

  const { product, variant } = detail;

  return (
    <div className="container-page py-10">
      <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> My Purchases
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{product.name}</h1>
          <p className="mt-1 text-ink-muted">
            {product.reels.length} reels · {variant === "CLEAN" ? "Non-watermarked" : "Watermarked"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ReelList
          productId={product.id}
          reels={product.reels.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            thumbnailKey: r.thumbnailKey,
            durationSec: r.durationSec,
          }))}
        />
      </div>
    </div>
  );
}
