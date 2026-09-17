"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, RotateCcw } from "lucide-react";
import { formatPaise, formatDateTime, cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { Inbox } from "lucide-react";

interface OrderRow {
  id: string;
  status: string;
  totalAmountPaise: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  user: { email: string; name: string | null };
  items: { productNameSnapshot: string; variant: string }[];
}

const STATUS_OPTIONS = ["", "CREATED", "PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"];

export function OrdersClient() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function refund(order: OrderRow) {
    if (!confirm(`Refund ${formatPaise(order.totalAmountPaise, order.currency)} to ${order.user.email}? This revokes their access.`)) return;
    setRefundingId(order.id);
    const res = await fetch(`/api/admin/orders/${order.id}/refund`, { method: "POST" });
    setRefundingId(null);
    if (res.ok) load();
    else {
      const data = await res.json();
      alert(data.error ?? "Refund failed");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or payment id…"
            className="input pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {orders === null ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState icon={Inbox} title="No orders found" description="Try a different search or filter." />
      ) : (
        <div className="card divide-y divide-border">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {order.items.map((i) => i.productNameSnapshot).join(", ") || "—"}
                </p>
                <p className="text-xs text-ink-faint">
                  {order.user.email} · {formatDateTime(order.createdAt)}
                </p>
                {order.razorpayPaymentId && (
                  <p className="text-xs text-ink-faint">Payment: {order.razorpayPaymentId}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium text-ink">{formatPaise(order.totalAmountPaise, order.currency)}</span>
                <StatusPill status={order.status} />
                {order.status === "PAID" && (
                  <button
                    onClick={() => refund(order)}
                    disabled={refundingId === order.id}
                    className="btn-ghost px-3 py-1.5 text-xs text-danger"
                  >
                    {refundingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Refund
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-success/15 text-success",
    PENDING: "bg-warning/15 text-warning",
    CREATED: "bg-ink-faint/15 text-ink-faint",
    FAILED: "bg-danger/15 text-danger",
    REFUNDED: "bg-accent/15 text-accent",
    CANCELLED: "bg-ink-faint/15 text-ink-faint",
  };
  return <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-medium", styles[status] ?? "")}>{status}</span>;
}
