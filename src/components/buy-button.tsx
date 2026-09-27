import Link from "next/link";

export function BuyButton({
  slug,
  productId,
  variant,
  owned,
  highlight,
}: {
  slug: string;
  productId: string;
  variant: "WATERMARKED" | "CLEAN";
  owned?: boolean;
  highlight?: boolean;
}) {
  if (owned) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            highlight
              ? "btn-primary px-4 py-2.5 text-sm"
              : "btn-secondary px-4 py-2.5 text-sm"
          }
        >
          Already Bought
        </span>

        <Link
          href={`/purchases/${productId}`}
          className="btn-secondary px-4 py-2.5 text-sm"
        >
          View Purchase
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={`/checkout/${slug}?variant=${variant}`}
      className={
        highlight
          ? "btn-primary px-4 py-2.5 text-sm"
          : "btn-secondary px-4 py-2.5 text-sm"
      }
    >
      Buy
    </Link>
  );
}