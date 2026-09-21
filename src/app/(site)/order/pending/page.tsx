import Link from "next/link";
import type { Metadata } from "next";
import { Clock3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment processing",
};

export default function OrderPendingPage() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-md flex-col items-center justify-center py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">
        <Clock3 size={32} />
      </div>

      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
        Payment is processing
      </h1>

      <p className="mt-2 text-ink-muted">
        We haven&apos;t received the final payment confirmation yet.
        Please wait a little and check My Purchases before trying
        to pay again.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/purchases"
          className="btn-primary px-6 py-3.5"
        >
          My Purchases
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