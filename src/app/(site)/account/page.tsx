import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, Download, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getUserOrderHistory, getUserDownloadHistory } from "@/server/services/account.service";
import { LogoutButton } from "@/components/logout-button";
import { AccountProfileForm } from "@/components/account-profile-form";
import { AccountEmailForm } from "@/components/account-email-form";
import { AccountPasswordForm } from "@/components/account-password-form";
import { EmptyState } from "@/components/empty-state";
import { AccountEmailVerification } from "@/components/account-email-verification";
import { formatDate, formatDateTime, formatPaise, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ordersPage?: string; downloadsPage?: string; }>;
}) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?callbackUrl=/account");

  const user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) redirect("/login");

  const params = await searchParams;

  const requestedOrdersPage = Number.parseInt(params.ordersPage ?? "1", 10);
  const ordersPage = Number.isFinite(requestedOrdersPage)
    ? Math.max(1, requestedOrdersPage)
    : 1;

  const requestedDownloadsPage = Number.parseInt(
    params.downloadsPage ?? "1",
    10,
  );
  const downloadsPage = Number.isFinite(requestedDownloadsPage)
    ? Math.max(1, requestedDownloadsPage)
    : 1;

  const [orderHistory, downloadHistory] = await Promise.all([
    getUserOrderHistory(user.id, ordersPage, 10),
    getUserDownloadHistory(user.id, downloadsPage, 10),
  ]);

  const { orders, totalPages: orderTotalPages } = orderHistory;
  const { downloads, totalPages: downloadTotalPages } = downloadHistory;

  return (
    <div className="container-page max-w-2xl py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Account
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          My Account
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Manage your profile, security, purchases, and account activity.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {/* --- Profile --- */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Profile</h2>
          <div className="card space-y-4 p-5">
            <AccountProfileForm initialName={user.name ?? ""} />
            <div className="border-t border-border pt-4 text-sm text-ink-muted">
              Member since {formatDate(user.createdAt)}
            </div>
          </div>
        </section>

        {/* --- Security --- */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Security</h2>
          <div className="card space-y-5 p-5">
            <AccountEmailVerification
              email={user.email}
              verified={!!user.emailVerifiedAt}
            />

            <div className="border-t border-border pt-5">
              <AccountEmailForm currentEmail={user.email} />
            </div>

            <div className="border-t border-border pt-5">
              <AccountPasswordForm />
            </div>
          </div>
        </section>

        {/* --- Purchases shortcut --- */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold tracking -tight text-ink">Purchases</h2>
          <Link
            href="/purchases"
            className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <ShoppingBag size={18} />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    My Purchases
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Access your purchased bundles and downloads.
                  </p>
                </div>
              </div>

              <span
                aria-hidden="true"
                className="shrink-0 text-lg text-ink-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
              >
                →
              </span>
            </div>
          </Link>
        </section>

        {/* --- Order history --- */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">
            Order history
          </h2>

          {orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="Your past orders will show up here once you make a purchase."
            />
          ) : (
            <>
              <div className="card divide-y divide-border">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-raised/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {order.items.map((i) => i.productNameSnapshot).join(", ") || "—"}
                      </p>

                      <p className="text-xs text-ink-faint">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-ink">
                        {formatPaise(order.totalAmountPaise, order.currency)}
                      </p>

                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>

              {orderTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  {ordersPage > 1 ? (
                    <Link
                      href={`/account?ordersPage=${ordersPage - 1}`}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span />
                  )}

                  <span className="text-xs text-ink-faint">
                    Page {ordersPage} of {orderTotalPages}
                  </span>

                  {ordersPage < orderTotalPages ? (
                    <Link
                      href={`/account?ordersPage=${ordersPage + 1}`}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* --- Recent download activity --- */}
        {/* --- Recent download activity --- */}
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">
            Recent downloads
          </h2>

          {downloads.length === 0 ? (
            <EmptyState icon={Download} title="No downloads yet" />
          ) : (
            <>
              <div className="card divide-y divide-border">
                {downloads.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-raised/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {log.reel?.title ?? "Batch download"}
                      </p>

                      <p className="text-xs text-ink-faint">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-medium",
                        log.success
                          ? "bg-success/15 text-success"
                          : "bg-danger/15 text-danger",
                      )}
                    >
                      {log.success ? "Success" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>

              {downloadTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  {downloadsPage > 1 ? (
                    <Link
                      href={`/account?ordersPage=${ordersPage}&downloadsPage=${downloadsPage - 1}`}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span />
                  )}

                  <span className="text-xs text-ink-faint">
                    Page {downloadsPage} of {downloadTotalPages}
                  </span>

                  {downloadsPage < downloadTotalPages ? (
                    <Link
                      href={`/account?ordersPage=${ordersPage}&downloadsPage=${downloadsPage + 1}`}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <div className="flex justify-end border-t border-border pt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-success/15 text-success",
    PENDING: "bg-warning/15 text-warning",
    CREATED: "bg-ink-faint/15 text-ink-faint",
    FAILED: "bg-danger/15 text-danger",
    REFUNDED: "bg-accent/15 text-accent",
    CANCELLED: "bg-ink-faint/15 text-ink-faint",
  };

  return (
    <span
      className={cn(
        "mt-1 inline-block rounded-pill px-2 py-0.5 text-[10px] font-medium",
        styles[status] ?? ""
      )}
    >
      {status}
    </span>
  );
}