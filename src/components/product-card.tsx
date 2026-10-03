import Link from "next/link";
import { Play, Film } from "lucide-react";
import { formatPaise } from "@/lib/utils";

export interface ProductCardData {
  slug: string;
  name: string;
  shortDescription?: string | null;
  thumbnailKey?: string | null;
  watermarkedPriceInPaise?: number | null;
  cleanPriceInPaise?: number | null;
  currency: string;
  reelCount: number;
  featured?: boolean;
  categoryName?: string | null;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const startingPrice =
    product.watermarkedPriceInPaise != null
      ? product.watermarkedPriceInPaise
      : product.cleanPriceInPaise;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group card block overflow-hidden transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[9/13] w-full overflow-hidden bg-surface-raised">
        {product.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/thumbnail?key=${encodeURIComponent(product.thumbnailKey)}`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <Film size={32} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3 pt-10">
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-black/35 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            <Play size={11} fill="currentColor" />
            {product.reelCount} reels
          </div>
        </div>

        {product.featured && (
          <span className="absolute left-3 top-3 rounded-pill border border-white/20 bg-accent/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
            Featured
          </span>
        )}
      </div>

      <div className="p-4">
        {product.categoryName && (
          <p className="text-eyebrow">{product.categoryName}</p>
        )}

        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] font-display text-base font-semibold leading-5 text-ink">
          {product.name}
        </h3>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-ink-muted">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-4 flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold text-ink">
            {formatPaise(startingPrice, product.currency)}
          </span>

          {startingPrice != null && (
            <span className="text-[11px] text-ink-faint">starting at</span>
          )}
        </div>
      </div>
    </Link>
  );
}