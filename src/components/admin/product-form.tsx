"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  categoryId: string | null;
  description: string;
  shortDescription: string;
  watermarkedPriceInPaise: number | null;
  cleanPriceInPaise: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  purchasable: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  licenseText: string;
}

const empty: ProductFormValues = {
  name: "",
  slug: "",
  categoryId: null,
  description: "",
  shortDescription: "",
  watermarkedPriceInPaise: 4900,
  cleanPriceInPaise: 13900,
  status: "DRAFT",
  featured: false,
  purchasable: true,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
  licenseText: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ProductForm({
  initial,
  categories,
}: {
  initial?: Partial<ProductFormValues>;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({ ...empty, ...initial });
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...values,
      shortDescription: values.shortDescription || null,
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
      licenseText: values.licenseText || null,
    };

    const res = await fetch(values.id ? `/api/admin/products/${values.id}` : "/api/admin/products", {
      method: values.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save product.");
      return;
    }

    const id = values.id ?? data.product.id;
    router.push(`/admin/products/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-4 p-5">
        <h2 className="font-display text-base font-semibold text-ink">Basics</h2>

        <div>
          <label className="label">Bundle name</label>
          <input
            required
            value={values.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
            className="input"
            placeholder="AI Snake Reels Vol. 01"
          />
        </div>

        <div>
          <label className="label">Slug (URL)</label>
          <input
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
            className="input"
          />
          <p className="mt-1 text-xs text-ink-faint">yoursite.com/product/{values.slug || "..."}</p>
        </div>

        <div>
          <label className="label">Category</label>
          <select
            value={values.categoryId ?? ""}
            onChange={(e) => set("categoryId", e.target.value || null)}
            className="input"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Short description (shown on cards)</label>
          <input
            maxLength={300}
            value={values.shortDescription}
            onChange={(e) => set("shortDescription", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Full description</label>
          <textarea
            rows={5}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-display text-base font-semibold text-ink">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceInput
            label="Watermarked price (₹)"
            valuePaise={values.watermarkedPriceInPaise}
            onChange={(p) => set("watermarkedPriceInPaise", p)}
          />
          <PriceInput
            label="Non-watermarked price (₹)"
            valuePaise={values.cleanPriceInPaise}
            onChange={(p) => set("cleanPriceInPaise", p)}
          />
        </div>
        <p className="text-xs text-ink-faint">Leave a price empty to hide that variant from customers.</p>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-display text-base font-semibold text-ink">Visibility</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Status</label>
            <select value={values.status} onChange={(e) => set("status", e.target.value as any)} className="input">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="label">Sort order</label>
            <input
              type="number"
              value={values.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
              className="input"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox label="Featured on homepage" checked={values.featured} onChange={(v) => set("featured", v)} />
          <Checkbox label="Purchasable" checked={values.purchasable} onChange={(v) => set("purchasable", v)} />
        </div>
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer font-display text-base font-semibold text-ink">SEO & license (optional)</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">SEO title</label>
            <input value={values.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">SEO description</label>
            <input value={values.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">License override (leave empty to use the site default)</label>
            <textarea rows={4} value={values.licenseText} onChange={(e) => set("licenseText", e.target.value)} className="input" />
          </div>
        </div>
      </details>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {values.id ? "Save changes" : "Create bundle"}
      </button>
    </form>
  );
}

function PriceInput({
  label,
  valuePaise,
  onChange,
}: {
  label: string;
  valuePaise: number | null;
  onChange: (paise: number | null) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={valuePaise != null ? (valuePaise / 100).toString() : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Math.round(Number(v) * 100));
        }}
        className="input"
        placeholder="Empty = not for sale"
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border" />
      {label}
    </label>
  );
}
