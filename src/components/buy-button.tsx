import Link from "next/link";

export function BuyButton({
  slug,
  variant,
  highlight,
}: {
  slug: string;
  variant: "WATERMARKED" | "CLEAN";
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/checkout/${slug}?variant=${variant}`}
      className={highlight ? "btn-primary px-4 py-2.5 text-sm" : "btn-secondary px-4 py-2.5 text-sm"}
    >
      Buy
    </Link>
  );
}
