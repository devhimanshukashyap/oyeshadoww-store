"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

interface CustomerRow {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { orders: number; purchases: number };
}

export function CustomersClient() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/customers?${params.toString()}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="input pl-9" />
      </div>

      {customers === null ? (
        <TableSkeleton />
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" />
      ) : (
        <div className="card divide-y divide-border">
          {customers.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-ink">{c.name ?? "—"}</p>
                <p className="text-xs text-ink-faint">{c.email}</p>
              </div>
              <div className="text-right text-xs text-ink-faint">
                <p>{c._count.orders} orders · {c._count.purchases} purchases</p>
                <p>Joined {formatDateTime(c.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
