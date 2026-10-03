import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { listActiveCategories, listPublishedProducts } from "@/server/services/product.service";
import { cn } from "@/lib/utils";
import { PackageSearch } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
    <div className="container-page py-10 md:py-14">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop bundles" },
        ]}
      />

      <header className="relative mt-8 overflow-hidden rounded-[2rem] border border-border bg-surface-raised px-6 py-10 md:px-10 md:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative max-w-2xl">
          <p className="text-eyebrow">The collection</p>

          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Find your next reel bundle.
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted sm:text-base">
            AI-generated reels made to be downloaded, posted, and put to work.
            Browse the collection or filter by category.
          </p>
        </div>
      </header>

      {categories.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-ink">Browse categories</p>

            {activeCategory && (
              <Link
                href="/shop"
                className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Clear filter
              </Link>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            <Link
              href="/shop"
              className={cn(
                "shrink-0 rounded-pill border px-4 py-2 text-sm font-medium transition-all",
                !activeCategory
                  ? "border-accent bg-accent/15 text-ink shadow-sm"
                  : "border-border bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
              )}
            >
              All bundles
            </Link>

            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className={cn(
                  "shrink-0 rounded-pill border px-4 py-2 text-sm font-medium transition-all",
                  activeCategory === category.slug
                    ? "border-accent bg-accent/15 text-ink shadow-sm"
                    : "border-border bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
                )}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Suspense
        key={activeCategory ?? "all"}
        fallback={<ProductGridSkeleton />}
      >
        <ProductGrid categorySlug={activeCategory} />
      </Suspense>
    </div>
  );
}

async function ProductGrid({ categorySlug }: { categorySlug?: string }) {
  const products = await listPublishedProducts({ categorySlug });

  if (products.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState
          icon={PackageSearch}
          title="No bundles here yet"
          description="Try a different category, or check back soon — new bundles are added regularly."
        />
      </div>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">
            {products.length} {products.length === 1 ? "bundle" : "bundles"}
          </p>

          <h2 className="mt-1 font-display text-xl font-semibold text-ink">
            {categorySlug ? "Matching bundles" : "All bundles"}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={{
              slug: product.slug,
              name: product.name,
              shortDescription: product.shortDescription,
              thumbnailKey: product.thumbnailKey,
              watermarkedPriceInPaise: product.watermarkedPriceInPaise,
              cleanPriceInPaise: product.cleanPriceInPaise,
              currency: product.currency,
              reelCount: product._count.reels,
              featured: product.featured,
              categoryName: product.category?.name,
            }}
          />
        ))}
      </div>
    </section>
  );
}