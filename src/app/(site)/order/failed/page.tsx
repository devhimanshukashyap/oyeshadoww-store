import Link from "next/link";
import type { Metadata } from "next";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment failed",
};

export default function OrderFailedPage({
  searchParams,
}: {
  searchParams: {
    reason?: string;
  };
}) {
  const cancelled =
    searchParams.reason === "cancelled";

  return (
    <div className="container-page flex min-h-[60vh] max-w-md flex-col items-center justify-center py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 text-danger">
        <XCircle size={32} />
      </div>

      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
        {cancelled
          ? "Payment cancelled"
          : "Payment failed"}
      </h1>

      <p className="mt-2 text-ink-muted">
        {cancelled
          ? "The payment checkout was closed before the payment was completed."
          : "We couldn't complete this payment. If money was debited, please wait for the payment status to update before trying again."}
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/shop"
          className="btn-primary px-6 py-3.5"
        >
          Try again
        </Link>

        <Link
          href="/contact"
          className="btn-secondary px-6 py-3.5"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}