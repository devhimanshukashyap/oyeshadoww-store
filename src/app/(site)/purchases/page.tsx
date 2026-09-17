import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserPurchases } from "@/server/services/product.service";
import { EmptyState } from "@/components/empty-state";
import { formatPaise, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My Purchases" };
export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/purchases");

  const purchases = await getUserPurchases(user.id);

  // Group by product so a user who bought both variants sees one card.
  const byProduct = new Map<string, typeof purchases>();
  for (const p of purchases) {
    const list = byProduct.get(p.productId) ?? [];
    list.push(p);
    byProduct.set(p.productId, list);
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">My Purchases</h1>
      <p className="mt-1 text-ink-muted">Everything you&apos;ve bought, ready to download.</p>

      {byProduct.size === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Package}
            title="No purchases yet"
            description="Once you buy a bundle, it'll show up here with instant download access."
            action={
              <Link href="/shop" className="btn-primary mt-2">
                Browse bundles
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...byProduct.entries()].map(([productId, list]) => {
            const best = list.find((p) => p.variant === "CLEAN") ?? list[0];
            const hasClean = list.some((p) => p.variant === "CLEAN");
            return (
              <Link key={productId} href={`/purchases/${productId}`} className="card block p-4 transition-transform hover:-translate-y-0.5">
                <p className="font-display text-lg font-semibold text-ink">{best.product.name}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {best.product._count.reels} reels · {hasClean ? "Non-watermarked" : "Watermarked"}
                </p>
                <p className="mt-3 text-xs text-ink-faint">Purchased {formatDate(best.grantedAt)}</p>
                <p className="mt-1 text-xs text-ink-faint">{formatPaise(best.order.totalAmountPaise, best.order.currency)}</p>
                <span className="btn-secondary mt-4 w-full">Open bundle</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
