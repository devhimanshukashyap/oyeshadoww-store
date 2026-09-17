import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ProductsTable } from "@/components/admin/products-table";

export const metadata: Metadata = { title: "Products", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: { category: true, _count: { select: { reels: { where: { deletedAt: null } } } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus size={16} />
          Create Bundle
        </Link>
      </div>

      <div className="mt-6">
        <ProductsTable
          initialProducts={products.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            featured: p.featured,
            reelCount: p._count.reels,
            watermarkedPriceInPaise: p.watermarkedPriceInPaise,
            cleanPriceInPaise: p.cleanPriceInPaise,
            currency: p.currency,
            categoryName: p.category?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
