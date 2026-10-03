import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Film, Check, ShieldCheck } from "lucide-react";
import { getPublishedProductBySlug, getUserOwnedVariants } from "@/server/services/product.service";
import { getSettings } from "@/lib/settings";
import { formatPaise } from "@/lib/utils";
import { ProductDetailSkeleton } from "@/components/skeletons";
import { BuyButton } from "@/components/buy-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getPublishedProductBySlug(params.slug);

  if (!product) return { title: "Bundle not found" };

  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.shortDescription ?? undefined,
    },
  };
}

export default function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="container-page py-10">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetail slug={params.slug} />
      </Suspense>
    </div>
  );
}

async function ProductDetail({ slug }: { slug: string }) {
  const user = await getCurrentUser();

  const [product, settings] = await Promise.all([
    getPublishedProductBySlug(slug),
    getSettings(),
  ]);

  if (!product) {
    notFound();
  }

  const ownedVariants = user
    ? await getUserOwnedVariants(user.id, product.id)
    : [];

  if (!product) notFound();

  const licenseText = product.licenseText || settings.defaultLicenseText;

  const hasBundle = product.reels.some(
    (reel) => reel.watermarkedObjectId !== null,
  );

  const hasBundlePlus = product.reels.some(
    (reel) => reel.cleanObjectId !== null,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: (
        (product.watermarkedPriceInPaise ??
          product.cleanPriceInPaise ??
          0) / 100
      ).toFixed(2),
      availability: product.purchasable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop bundles", href: "/shop" },
          { label: product.name },
        ]}
      />
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <div className="grid gap-10 md:grid-cols-2">
        {/* Preview */}
        <div>
          <div className="sticky top-24 mx-auto max-w-sm">
            <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border bg-surface-raised">
              {product.previewVideoKey ? (
                <video
                  className="h-full w-full object-cover"
                  controls
                  preload="none"
                  poster={
                    product.thumbnailKey
                      ? `/api/media/thumbnail?key=${encodeURIComponent(
                        product.thumbnailKey
                      )}`
                      : undefined
                  }
                >
                  <source
                    src={`/api/media/preview?key=${encodeURIComponent(
                      product.previewVideoKey
                    )}`}
                  />
                </video>
              ) : product.thumbnailKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/thumbnail?key=${encodeURIComponent(
                    product.thumbnailKey
                  )}`}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-faint">
                  <Film size={40} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product information */}
        <div>
          {product.category && (
            <p className="text-eyebrow">{product.category.name}</p>
          )}

          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
            {product.name}
          </h1>

          <p className="mt-2 text-sm text-ink-muted">
            {product.reels.length} reels included
          </p>

          {product.shortDescription && (
            <p className="mt-4 text-ink-muted">
              {product.shortDescription}
            </p>
          )}

          {/* Purchase options */}
          <div className="mt-6 space-y-3">
            {hasBundle && product.watermarkedPriceInPaise != null && (
              <PricingRow
                slug={product.slug}
                variant="WATERMARKED"
                label="Bundle"
                productId={product.id}
                owned={ownedVariants.includes("WATERMARKED")}
                note="Watermarked reels"
                price={formatPaise(
                  product.watermarkedPriceInPaise,
                  product.currency
                )}
              />
            )}

            {hasBundlePlus && product.cleanPriceInPaise != null && (
              <PricingRow
                slug={product.slug}
                variant="CLEAN"
                label="Bundle+"
                productId={product.id}
                owned={ownedVariants.includes("CLEAN")}
                note="Non-watermarked reels + premium extras"
                price={formatPaise(
                  product.cleanPriceInPaise,
                  product.currency
                )}
                highlight
              />
            )}
          </div>
          {hasBundlePlus && (
            <div className="mt-5 rounded-card border border-border bg-surface-raised p-4">
              <p className="text-sm font-medium text-ink">
                Why choose Bundle+?
              </p>

              <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />
                  Non-watermarked, clean reels
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />
                  Premium extras when available
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />
                  Future Bundle+ updates
                </li>
              </ul>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
            <ShieldCheck size={14} />
            Secure payment via Cashfree · Instant access after payment
          </div>

          {product.description && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold text-ink">
                About this bundle
              </h2>

              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                {product.description}
              </p>
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-ink">
              What&apos;s included
            </h2>

            <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                {product.reels.length} ready-to-post reels
              </li>

              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                Individual & batch download
              </li>

              <li className="flex items-center gap-2">
                <Check size={14} className="text-success" />
                Lifetime access from your account
              </li>
            </ul>
          </div>

          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-ink">
              Usage & license
            </h2>

            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {licenseText}
            </p>
          </div>

          <p className="mt-8 text-xs text-ink-faint">
            Have a question first?{" "}
            <Link
              href="/faq"
              className="text-accent hover:underline"
            >
              Read the FAQ
            </Link>{" "}
            or{" "}
            <Link
              href="/contact"
              className="text-accent hover:underline"
            >
              contact us
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingRow({
  slug,
  variant,
  label,
  note,
  price,
  highlight,
  productId,
  owned,
}: {
  slug: string;
  variant: "WATERMARKED" | "CLEAN";
  label: string;
  note: string;
  price: string;
  highlight?: boolean;
  productId: string;
  owned: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-card border p-4 ${highlight
        ? "border-accent bg-accent/10"
        : "border-border bg-surface"
        }`}
    >
      <div>
        <p className="font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{note}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-semibold text-ink">
          {price}
        </span>

        <BuyButton
          slug={slug}
          productId={productId}
          variant={variant}
          owned={owned}
          highlight={highlight}
        />
      </div>
    </div>
  );
}