"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

interface DesktopHeroPreviewProps {
  heroPreviewUrl: string;
  heroPreviewProduct: {
    name: string;
    slug: string;
  } | null;
}

export function DesktopHeroPreview({
  heroPreviewUrl,
  heroPreviewProduct,
}: DesktopHeroPreviewProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
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
              <p className="text-xs font-medium text-ink">Instant access</p>
              <p className="text-[11px] text-ink-faint">
                After payment clears
              </p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}