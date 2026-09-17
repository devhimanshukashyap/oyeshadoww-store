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
      className="group card block overflow-hidden transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[9/13] w-full overflow-hidden bg-surface-raised">
        {product.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/thumbnail?key=${encodeURIComponent(product.thumbnailKey)}`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <Film size={32} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <Play size={12} fill="currentColor" />
            {product.reelCount} reels
          </div>
        </div>

        {product.featured && (
          <span className="absolute left-3 top-3 rounded-pill bg-accent px-2.5 py-1 text-xs font-medium text-white">
            Featured
          </span>
        )}
      </div>

      <div className="p-4">
        {product.categoryName && (
          <p className="text-eyebrow">{product.categoryName}</p>
        )}
        <h3 className="mt-1 font-display text-base font-semibold text-ink">{product.name}</h3>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{product.shortDescription}</p>
        )}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-ink">
            {formatPaise(startingPrice, product.currency)}
          </span>
          {startingPrice != null && <span className="text-xs text-ink-faint">starting at</span>}
        </div>
      </div>
    </Link>
  );
}
