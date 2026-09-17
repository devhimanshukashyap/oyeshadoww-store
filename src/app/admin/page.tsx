import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDashboardStats } from "@/server/services/dashboard.service";
import { formatPaise, formatDateTime } from "@/lib/utils";
import {
  IndianRupee,
  ShoppingCart,
  Users,
  Package,
  Film,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  const stats = await getDashboardStats();

  const cards = [
    { label: "Total revenue", value: formatPaise(stats.totalRevenuePaise), Icon: IndianRupee },
    { label: "Today's revenue", value: formatPaise(stats.todayRevenuePaise), Icon: IndianRupee },
    { label: "Total orders", value: stats.totalOrders, Icon: ShoppingCart },
    { label: "Today's orders", value: stats.todayOrders, Icon: ShoppingCart },
    { label: "Paid orders", value: stats.paidOrders, Icon: CheckCircle2 },
    { label: "Failed payments", value: stats.failedOrders, Icon: AlertCircle },
    { label: "Refunded orders", value: stats.refundedOrders, Icon: RefreshCcw },
    { label: "Customers", value: stats.totalCustomers, Icon: Users },
    { label: "Products", value: stats.totalProducts, Icon: Package },
    { label: "Reels", value: stats.totalReels, Icon: Film },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 text-ink-faint">
              <Icon size={14} />
              <span className="text-xs">{label}</span>
            </div>
            <p className="mt-2 font-display text-xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <div className="card divide-y divide-border">
            {stats.recentOrders.length === 0 && <p className="p-4 text-sm text-ink-muted">No orders yet.</p>}
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{order.user.email}</p>
                  <p className="text-xs text-ink-faint">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-ink">{formatPaise(order.totalAmountPaise, order.currency)}</p>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Recent customers</h2>
            <Link href="/admin/customers" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <div className="card divide-y divide-border">
            {stats.recentCustomers.length === 0 && <p className="p-4 text-sm text-ink-muted">No customers yet.</p>}
            {stats.recentCustomers.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{c.name ?? "—"}</p>
                  <p className="text-xs text-ink-faint">{c.email}</p>
                </div>
                <p className="text-xs text-ink-faint">{formatDateTime(c.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-success/15 text-success",
    PENDING: "bg-warning/15 text-warning",
    CREATED: "bg-ink-faint/15 text-ink-faint",
    FAILED: "bg-danger/15 text-danger",
    REFUNDED: "bg-accent/15 text-accent",
    CANCELLED: "bg-ink-faint/15 text-ink-faint",
  };
  return (
    <span className={`mt-1 inline-block rounded-pill px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
