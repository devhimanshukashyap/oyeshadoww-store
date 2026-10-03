import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getUserPurchases } from "@/server/services/product.service";
import { EmptyState } from "@/components/empty-state";
import { formatPaise, formatDate } from "@/lib/utils";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "My Purchases" },
        ]}
      />

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Your library
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          My Purchases
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Everything you&apos;ve bought, ready whenever you want to download it.
        </p>
      </div>

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
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...byProduct.entries()].map(([productId, list]) => {
            const best = list.find((p) => p.variant === "CLEAN") ?? list[0];
            const hasClean = list.some((p) => p.variant === "CLEAN");

            return (
              <Link
                key={productId}
                href={`/purchases/${productId}`}
                className="group rounded-card border border-border bg-surface p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold leading-tight text-ink">
                      {best.product.name}
                    </p>

                    <p className="mt-2 text-sm text-ink-muted">
                      {best.product._count.reels}{" "}
                      {best.product._count.reels === 1 ? "reel" : "reels"} included
                    </p>
                  </div>

                  <span
                    className={
                      hasClean
                        ? "shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent"
                        : "shrink-0 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
                    }
                  >
                    {hasClean ? "Bundle+" : "Bundle"}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-surface-raised px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-faint">Access</span>
                    <span className="text-xs font-medium text-ink">
                      {hasClean ? "Non-watermarked" : "Watermarked"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-faint">Purchased</span>
                    <span className="text-xs font-medium text-ink">
                      {formatDate(best.grantedAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-faint">Paid</span>
                    <span className="text-xs font-medium text-ink">
                      {formatPaise(
                        best.order.totalAmountPaise,
                        best.order.currency
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors group-hover:border-accent/40 group-hover:bg-accent/5">
                  <span className="text-sm font-medium text-ink">
                    Open bundle
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-lg text-ink-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
                  >
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}