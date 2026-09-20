import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPurchasedProductDetail } from "@/server/services/product.service";
import { PurchasedReelView } from "@/components/purchased-reel-view";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BundlePlusExtraDownload } from "@/components/bundle-plus-extra-download";

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

  const { product, ownedVariants, bundlePlusExtras } = detail;

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
        {bundlePlusExtras.length > 0 && (
          <section className="mt-10">
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-ink">
                Bundle+ Extras
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Extra resources included with your Bundle+ purchase.
              </p>
            </div>

            <div className="space-y-3">
              {bundlePlusExtras.map((extra) => (
                <div
                  key={extra.id}
                  className="card p-4"
                >
                  <h3 className="font-medium text-ink">
                    {extra.title}
                  </h3>

                  {extra.description && (
                    <p className="mt-1 text-sm text-ink-muted">
                      {extra.description}
                    </p>
                  )}

                  {extra.type === "TEXT" && extra.content && (
                    <div className="mt-4 rounded-lg bg-surface-raised p-4 text-sm text-ink whitespace-pre-wrap">
                      {extra.content}
                    </div>
                  )}

                  {extra.type === "FILE" && (
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-surface-raised p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {extra.fileName ?? "Downloadable file"}
                        </p>

                        {extra.fileContentType && (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {extra.fileContentType}
                          </p>
                        )}
                      </div>

                      <BundlePlusExtraDownload
                        productId={product.id}
                        extraId={extra.id}
                        fileName={extra.fileName ?? "bundle-plus-extra"}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}