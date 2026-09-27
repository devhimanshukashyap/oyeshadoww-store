import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, ShoppingBag, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment successful",
};

export default function OrderSuccessPage({
  searchParams,
}: {
  searchParams: {
    orderId?: string;
  };
}) {
  const hasOrderId = Boolean(searchParams.orderId);

  return (
    <div className="container-page flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-14 text-center">
      {hasOrderId ? (
        <>
          {/* Success animation */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="success-ring absolute inset-0 rounded-full border-2 border-success/30" />

            <span className="success-icon relative flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <Check size={34} strokeWidth={2.5} />
            </span>

            <Sparkles
              size={14}
              className="success-sparkle success-sparkle-one absolute -right-1 top-1 text-success"
            />
            <Sparkles
              size={12}
              className="success-sparkle success-sparkle-two absolute -left-1 bottom-2 text-accent"
            />
            <Sparkles
              size={11}
              className="success-sparkle success-sparkle-three absolute -right-3 bottom-5 text-warning"
            />
          </div>

          <h1 className="success-content mt-5 font-display text-2xl font-semibold text-ink">
            Payment successful
          </h1>

          <p className="success-content success-delay-1 mt-2 max-w-md text-sm leading-6 text-ink-muted">
            Your payment has been received and your bundle is available in My
            Purchases.
          </p>

          <div className="success-content success-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/purchases"
              className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5"
            >
              <ShoppingBag size={17} />
              Open My Purchases
              <ArrowRight size={16} />
            </Link>

            <Link href="/shop" className="btn-secondary px-6 py-3.5">
              Continue shopping
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-faint/10 text-ink-muted">
            <ShoppingBag size={30} />
          </div>

          <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
            Payment confirmation
          </h1>

          <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
            We couldn&apos;t find a payment order to confirm. Please check My
            Purchases or contact support if you completed a payment.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/purchases" className="btn-primary px-6 py-3.5">
              Open My Purchases
            </Link>

            <Link href="/contact" className="btn-secondary px-6 py-3.5">
              Contact support
            </Link>
          </div>
        </>
      )}
    </div>
  );
}