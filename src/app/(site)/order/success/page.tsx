import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

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
    <div className="container-page flex min-h-[60vh] max-w-md flex-col items-center justify-center py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 size={32} />
      </div>

      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
        {hasOrderId
          ? "Payment successful"
          : "Payment confirmation"}
      </h1>

      <p className="mt-2 text-ink-muted">
        {hasOrderId
          ? "Your bundle has been added to My Purchases."
          : "We couldn't find a payment order to confirm. Please check My Purchases or contact support if you completed a payment."}
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/purchases"
          className="btn-primary px-6 py-3.5"
        >
          Open My Purchases
        </Link>

        {!hasOrderId && (
          <Link
            href="/contact"
            className="btn-secondary px-6 py-3.5"
          >
            Contact support
          </Link>
        )}
      </div>
    </div>
  );
}