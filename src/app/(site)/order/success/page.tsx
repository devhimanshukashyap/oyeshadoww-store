import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Payment successful" };

export default function OrderSuccessPage() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-md flex-col items-center justify-center py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 size={32} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Payment successful</h1>
      <p className="mt-2 text-ink-muted">Your bundle has been added to My Purchases.</p>
      <Link href="/purchases" className="btn-primary mt-8 px-6 py-3.5">
        Open My Purchases
      </Link>
    </div>
  );
}
