import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPurchasedProductDetail } from "@/server/services/product.service";
import { PurchasedReelView } from "@/components/purchased-reel-view";
import { ChevronLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata: Metadata = { title: "Your bundle" };
export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: { productId: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=/purchases/${params.productId}`);
  }

  const detail = await getPurchasedProductDetail(user.id, params.productId);

  if (!detail) notFound();

  const { product, ownedVariants } = detail;

  return (
    <div className="container-page py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "My Purchases", href: "/purchases" },
          { label: product.name },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {product.name}
        </h1>

        <p className="mt-1 text-ink-muted">
          {product.reels.length} reels ·{" "}
          {ownedVariants.length === 2
            ? "Watermarked + Non-watermarked"
            : ownedVariants[0] === "CLEAN"
              ? "Non-watermarked"
              : "Watermarked"}
        </p>
      </div>

      <div className="mt-8">
        <PurchasedReelView
          productId={product.id}
          ownedVariants={ownedVariants}
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