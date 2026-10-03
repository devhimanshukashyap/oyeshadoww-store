import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck, Zap, Download } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/skeletons";
import { listPublishedProducts } from "@/server/services/product.service";
import { getSettings } from "@/lib/settings";
import type { Metadata } from "next";
import { createDownloadUrl } from "@/lib/r2";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "AI reel bundles, ready to post",
};

export const revalidate = 60;

export default async function HomePage() {
  const settings = await getSettings();

  let heroPreviewUrl: string | null = null;
  let heroPreviewProduct: {
    name: string;
    slug: string;
  } | null = null;

  if (settings.heroPreviewType === "VIDEO" && settings.heroPreviewVideoKey) {
    heroPreviewUrl = await createDownloadUrl({
      key: settings.heroPreviewVideoKey,
      expiresInSeconds: 300,
    });
  }

  if (settings.heroPreviewType === "PRODUCT" && settings.heroPreviewProductId) {
    const product = await db.product.findFirst({
      where: {
        id: settings.heroPreviewProductId,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: {
        name: true,
        slug: true,
        previewVideoKey: true,
      },
    });

    if (product?.previewVideoKey) {
      heroPreviewUrl = await createDownloadUrl({
        key: product.previewVideoKey,
        expiresInSeconds: 300,
      });

      heroPreviewProduct = {
        name: product.name,
        slug: product.slug,
      };
    }
  }

  return (
    <div>
      <Hero
        brandHandle={settings.brandHandle}
        tagline={settings.tagline}
        heroPreviewUrl={heroPreviewUrl}
        heroPreviewProduct={heroPreviewProduct}
      />

      <section className="container-page py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-eyebrow">Featured</p>
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Popular bundles</h2>
          </div>
          <Link href="/shop" className="hidden text-sm text-ink-muted hover:text-ink sm:block">
            View all →
          </Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <FeaturedProducts />
        </Suspense>
        <Link href="/shop" className="mt-6 block text-center text-sm text-ink-muted hover:text-ink sm:hidden">
          View all bundles →
        </Link>
      </section>

      <HowItWorks />
      <TrustSection />
    </div>
  );
}

async function FeaturedProducts() {
  const products = await listPublishedProducts({ featuredOnly: true });
  const fallback = products.length ? products : await listPublishedProducts();

  if (fallback.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border px-6 py-16 text-center text-ink-muted">
        Bundles are on the way — check back soon.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {fallback.slice(0, 8).map((p) => (
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

function Hero({
  brandHandle,
  tagline,
  heroPreviewUrl,
  heroPreviewProduct,
}: {
  brandHandle: string;
  tagline: string;
  heroPreviewUrl: string | null;
  heroPreviewProduct: {
    name: string;
    slug: string;
  } | null;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-[12%] top-24 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container-page grid items-center gap-12 py-14 md:grid-cols-[1.05fr_0.95fr] md:py-24 lg:gap-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface/80 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {brandHandle}
            <span className="text-ink-faint">·</span>
            Ready to post
          </div>

          <h1 className="mt-6 text-hero tracking-tight">
            AI-made reels.
            <br />
            <span className="text-accent">Ready to post.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            {tagline} Grab a bundle, get instant access, and start posting
            today.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="btn-primary px-6 py-3.5 text-base shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Browse bundles
              <span aria-hidden="true"> →</span>
            </Link>

            <Link
              href="/about"
              className="btn-secondary px-6 py-3.5 text-base transition-transform hover:-translate-y-0.5"
            >
              How it works
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Secure checkout
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} />
              Instant access
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Download size={14} />
              Download anytime
            </span>
          </div>
        </div>

        {heroPreviewUrl && (
          <div className="relative mx-auto w-full max-w-[310px] md:max-w-[340px]">
            <div className="absolute -inset-6 rounded-[3rem] bg-accent/10 blur-3xl" />

            <Link
              href={
                heroPreviewProduct
                  ? `/product/${heroPreviewProduct.slug}`
                  : "/shop"
              }
              className="group relative block"
            >
              <div className="absolute -right-3 top-6 z-10 hidden rounded-2xl border border-border bg-surface/95 px-3 py-2 shadow-panel backdrop-blur sm:block">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                  Preview
                </p>
                <p className="mt-0.5 text-xs font-medium text-ink">
                  Watch before you buy
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-border bg-surface shadow-panel transition duration-500 group-hover:-translate-y-1 group-hover:shadow-lg">
                <div className="absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/20 to-transparent" />

                <video
                  src={heroPreviewUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                />

                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                {heroPreviewProduct ? (
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">
                      Featured bundle
                    </p>

                    <p className="mt-1 truncate font-display text-base font-semibold">
                      {heroPreviewProduct.name}
                    </p>

                    <p className="mt-1 text-xs text-white/75">
                      View bundle <span aria-hidden="true">→</span>
                    </p>
                  </div>
                ) : (
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="text-sm font-medium">
                      See the content before you buy.
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      Preview a reel bundle
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-panel backdrop-blur sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Zap size={15} />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-ink">
                      Instant access
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      After payment clears
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Pick a bundle", desc: "Browse reel bundles by category and preview before you buy." },
    { title: "Pay securely", desc: "Checkout with Cashfree — cards, UPI, netbanking, wallets." },
    { title: "Get instant access", desc: "Your bundle appears in My Purchases the moment payment clears." },
    { title: "Download & post", desc: "Preview, download individually, or grab the whole bundle at once." },
  ];

  return (
    <section className="border-t border-border bg-surface/40 py-16">
      <div className="container-page">
        <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="card p-5">
              <span className="font-display text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-medium text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const points = [
    { Icon: ShieldCheck, title: "Private & secure", desc: "Every file is protected — access is verified before any download." },
    { Icon: Download, title: "Download anytime", desc: "Your purchases stay in your account for you to re-download." },
    { Icon: Zap, title: "No waiting", desc: "Access is granted automatically the moment your payment is confirmed." },
  ];
  return (
    <section className="container-page py-16">
      <div className="grid gap-6 sm:grid-cols-3">
        {points.map(({ Icon, title, desc }) => (
          <div key={title} className="flex flex-col items-start gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Icon size={18} />
            </div>
            <p className="font-medium text-ink">{title}</p>
            <p className="text-sm text-ink-muted">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
