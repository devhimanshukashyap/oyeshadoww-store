"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Archive, Eye, EyeOff, Loader2 } from "lucide-react";
import { formatPaise, cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Package } from "lucide-react";

interface Row {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  reelCount: number;
  watermarkedPriceInPaise: number | null;
  cleanPriceInPaise: number | null;
  currency: string;
  categoryName: string | null;
}

export function ProductsTable({ initialProducts }: { initialProducts: Row[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function togglePublish(row: Row) {
    setBusyId(row.id);
    const nextStatus = row.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const res = await fetch(`/api/admin/products/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((p) => (p.id === row.id ? { ...p, status: nextStatus } : p)));
    }
    setBusyId(null);
  }

  async function duplicate(row: Row) {
    setBusyId(row.id);
    const res = await fetch(`/api/admin/products/${row.id}/duplicate`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/products/${data.product.id}`);
    }
  }

  async function archive(row: Row) {
    if (!confirm(`Archive "${row.name}"? It will be removed from the storefront. Order history is kept.`)) return;
    setBusyId(row.id);
    const res = await fetch(`/api/admin/products/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== row.id));
    }
    setBusyId(null);
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No bundles yet"
        description="Create your first bundle to start selling."
        action={
          <Link href="/admin/products/new" className="btn-primary mt-2">
            Create Bundle
          </Link>
        }
      />
    );
  }

  return (
    <div className="card divide-y divide-border">
      {products.map((row) => (
        <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/admin/products/${row.id}`} className="truncate font-medium text-ink hover:text-accent">
                {row.name}
              </Link>
              <StatusPill status={row.status} />
              {row.featured && <span className="rounded-pill bg-accent/15 px-2 py-0.5 text-[10px] text-accent">Featured</span>}
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {row.categoryName ?? "Uncategorized"} · {row.reelCount} reels ·{" "}
              {formatPaise(row.watermarkedPriceInPaise, row.currency)} watermarked /{" "}
              {formatPaise(row.cleanPriceInPaise, row.currency)} clean
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => togglePublish(row)} disabled={busyId === row.id} className="btn-secondary px-3 py-2 text-xs">
              {busyId === row.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : row.status === "PUBLISHED" ? (
                <EyeOff size={14} />
              ) : (
                <Eye size={14} />
              )}
              {row.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </button>
            <button onClick={() => duplicate(row)} disabled={busyId === row.id} className="btn-secondary px-3 py-2 text-xs">
              <Copy size={14} />
              Duplicate
            </button>
            <button onClick={() => archive(row)} disabled={busyId === row.id} className="btn-ghost px-3 py-2 text-xs text-danger">
              <Archive size={14} />
              Archive
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  const styles: Record<Row["status"], string> = {
    PUBLISHED: "bg-success/15 text-success",
    DRAFT: "bg-warning/15 text-warning",
    ARCHIVED: "bg-ink-faint/15 text-ink-faint",
  };
  return <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-medium", styles[status])}>{status}</span>;
}
