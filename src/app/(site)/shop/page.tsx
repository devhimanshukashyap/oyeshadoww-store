import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { listActiveCategories, listPublishedProducts } from "@/server/services/product.service";
import { cn } from "@/lib/utils";
import { PackageSearch } from "lucide-react";

export const metadata: Metadata = { title: "Shop bundles" };
export const revalidate = 30;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const categories = await listActiveCategories();
  const activeCategory = searchParams.category;

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Shop bundles</h1>
        <p className="mt-1 text-ink-muted">AI-generated reel bundles, ready to download and post.</p>
      </div>

      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/shop"
            className={cn(
              "rounded-pill border px-4 py-2 text-sm transition-colors",
              !activeCategory
                ? "border-accent bg-accent/15 text-ink"
                : "border-border text-ink-muted hover:text-ink"
            )}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.slug}`}
              className={cn(
                "rounded-pill border px-4 py-2 text-sm transition-colors",
                activeCategory === c.slug
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-border text-ink-muted hover:text-ink"
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <Suspense key={activeCategory ?? "all"} fallback={<ProductGridSkeleton />}>
        <ProductGrid categorySlug={activeCategory} />
      </Suspense>
    </div>
  );
}

async function ProductGrid({ categorySlug }: { categorySlug?: string }) {
  const products = await listPublishedProducts({ categorySlug });

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No bundles here yet"
        description="Try a different category, or check back soon — new bundles are added regularly."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={{
            slug: p.slug,
            name: p.name,
            shortDescription: p.shortDescription,
            thumbnailKey: p.thumbnailKey,
            watermarkedPriceInPaise: p.watermarkedPriceInPaise,
            cleanPriceInPaise: p.cleanPriceInPaise,
            currency: p.currency,
            reelCount: p._count.reels,
            featured: p.featured,
            categoryName: p.category?.name,
          }}
        />
      ))}
    </div>
  );
}
