import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { ProductAssetUpload } from "@/components/admin/product-asset-upload";
import { ProductReelsSection } from "@/components/admin/product-reels-section";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BundlePlusExtras } from "@/components/admin/bundle-plus-extras";

export const metadata: Metadata = { title: "Edit Bundle", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  const [product, categories] = await Promise.all([
    db.product.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        bundlePlusExtras: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        reels: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          include: { watermarkedObject: true, cleanObject: true },
        },
      },
    }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: product.name },
        ]}
      />
      <div className="flex items-center justify-between">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={16} /> Products
        </Link>
        {product.status === "PUBLISHED" && (
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            View live <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{product.name}</h1>

      <div className="mt-6 space-y-8">
        <ProductAssetUpload productId={product.id} thumbnailKey={product.thumbnailKey} previewVideoKey={product.previewVideoKey} />

        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Bundle details</h2>
          <ProductForm
            categories={categories}
            initial={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              categoryId: product.categoryId,
              description: product.description,
              shortDescription: product.shortDescription ?? "",
              watermarkedPriceInPaise: product.watermarkedPriceInPaise,
              cleanPriceInPaise: product.cleanPriceInPaise,
              status: product.status,
              featured: product.featured,
              purchasable: product.purchasable,
              sortOrder: product.sortOrder,
              seoTitle: product.seoTitle ?? "",
              seoDescription: product.seoDescription ?? "",
              licenseText: product.licenseText ?? "",
            }}
          />
          <BundlePlusExtras
            productId={product.id}
            initialExtras={product.bundlePlusExtras.map((extra) => ({
              id: extra.id,
              type: extra.type,
              title: extra.title,
              description: extra.description,
              content: extra.content,
              sortOrder: extra.sortOrder,
              fileName: extra.fileName,
            }))}
          />
        </div>

        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">
            Reels <span className="text-ink-faint">({product.reels.length})</span>
          </h2>
          <ProductReelsSection
            productId={product.id}
            initialReels={product.reels.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              sortOrder: r.sortOrder,
              visibility: r.visibility,
              thumbnailKey: r.thumbnailKey,
              watermarkedReady: r.watermarkedObject?.status === "READY",
              cleanReady: r.cleanObject?.status === "READY",
            }))}
          />
        </div>
      </div>
    </div>
  );
}
