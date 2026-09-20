import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck, Zap, Download} from "lucide-react";
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
        previewVideoKey: true,
      },
    });

    if (product?.previewVideoKey) {
      heroPreviewUrl = await createDownloadUrl({
        key: product.previewVideoKey,
        expiresInSeconds: 300,
      });
    }
  }

  return (
    <div>
      <Hero
        brandHandle={settings.brandHandle}
        tagline={settings.tagline}
        heroPreviewUrl={heroPreviewUrl}
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
}: {
  brandHandle: string;
  tagline: string;
  heroPreviewUrl: string | null;
}) {
  return (
    <section className="container-page grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
      <div>
        <p className="text-sm font-medium text-accent">{brandHandle}</p>
        <h1 className="mt-3 text-hero">
          AI-made reels, <br className="hidden sm:block" />ready to post.
        </h1>
        <p className="mt-4 max-w-md text-base text-ink-muted">{tagline} Grab a bundle, get instant access, and start posting today.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/shop" className="btn-primary px-6 py-3.5 text-base">
            Browse bundles
          </Link>
          <Link href="/about" className="btn-secondary px-6 py-3.5 text-base">
            How it works
          </Link>
        </div>
        <div className="mt-8 flex items-center gap-6 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> Secure checkout</span>
          <span className="inline-flex items-center gap-1.5"><Zap size={14} /> Instant access</span>
        </div>
      </div>

      {heroPreviewUrl && (
        <div className="relative mx-auto hidden w-full max-w-[280px] md:block">
          <div className="aspect-[9/16] w-full overflow-hidden rounded-[2rem] border border-border bg-surface shadow-panel">
            <video
              src={heroPreviewUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="absolute -right-6 -top-4 hidden rounded-2xl border border-border bg-surface px-4 py-3 shadow-panel sm:block">
            <p className="text-xs text-ink-muted">Preview</p>
            <p className="font-display text-lg font-semibold text-ink">
              Watch reel
            </p>
          </div>
        </div>
      )}
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
