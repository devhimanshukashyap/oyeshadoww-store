import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getPublishedProductBySlug } from "@/server/services/product.service";
import { formatPaise } from "@/lib/utils";
import { CheckoutPanel } from "@/components/checkout-panel";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { variant?: string };
}) {
  const variant = searchParams.variant === "CLEAN" ? "CLEAN" : "WATERMARKED";
  const callbackUrl = `/checkout/${params.slug}?variant=${variant}`;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  const product = await getPublishedProductBySlug(params.slug);
  if (!product) notFound();

  const pricePaise = variant === "CLEAN" ? product.cleanPriceInPaise : product.watermarkedPriceInPaise;
  if (pricePaise == null) notFound();

  return (
    <div className="container-page max-w-lg py-14">
      <h1 className="font-display text-2xl font-semibold text-ink">Checkout</h1>

      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">{product.name}</p>
            <p className="text-sm text-ink-muted">{variant === "CLEAN" ? "Non-watermarked" : "Watermarked"}</p>
          </div>
          <p className="font-display text-xl font-semibold text-ink">{formatPaise(pricePaise, product.currency)}</p>
        </div>
      </div>

      <CheckoutPanel productId={product.id} productName={product.name} variant={variant} userEmail={user.email ?? ""} />

      <p className="mt-6 text-center text-xs text-ink-faint">
        Payments are processed securely by Cashfree. We never see or store your card details.
      </p>
    </div>
  );
}
