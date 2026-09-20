"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { uploadFile } from "@/lib/upload-client";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [values, setValues] = useState<SiteSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [heroProducts, setHeroProducts] = useState<
    { id: string; name: string; slug: string }[]
  >([]);
  const [heroProductsLoading, setHeroProductsLoading] = useState(false);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  useEffect(() => {
    if (values.heroPreviewType !== "PRODUCT") return;

    async function loadHeroProducts() {
      setHeroProductsLoading(true);

      try {
        const res = await fetch("/api/admin/hero-products");
        if (!res.ok) throw new Error("Failed to load products");

        const data = await res.json();
        setHeroProducts(data.products ?? []);
      } catch (err) {
        console.error("Failed to load hero products:", err);
        setHeroProducts([]);
      } finally {
        setHeroProductsLoading(false);
      }
    }

    loadHeroProducts();
  }, [values.heroPreviewType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not save settings.");
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Branding">
        <Field label="Site name" value={values.siteName} onChange={(v) => set("siteName", v)} />
        <Field label="Brand handle" value={values.brandHandle} onChange={(v) => set("brandHandle", v)} />
        <Field label="Tagline" value={values.tagline} onChange={(v) => set("tagline", v)} />
        <Field label="Currency code" value={values.currency} onChange={(v) => set("currency", v)} hint="e.g. INR" />
      </Section>

      <Section title="Hero preview">
        <div>
          <label className="label">Preview type</label>

          <select
            value={values.heroPreviewType}
            onChange={(e) =>
              set(
                "heroPreviewType",
                e.target.value as SiteSettings["heroPreviewType"]
              )
            }
            className="input"
          >
            <option value="NONE">None</option>
            <option value="PRODUCT">Product preview</option>
            <option value="VIDEO">Custom video</option>
          </select>

          <p className="mt-1 text-xs text-ink-faint">
            Choose what appears in the vertical preview on the homepage.
          </p>
        </div>

        {values.heroPreviewType === "PRODUCT" && (
          <div>
            <label className="label">Product</label>

            <select
              value={values.heroPreviewProductId ?? ""}
              onChange={(e) =>
                set("heroPreviewProductId", e.target.value || null)
              }
              disabled={heroProductsLoading}
              className="input"
            >
              <option value="">
                {heroProductsLoading
                  ? "Loading products..."
                  : "Select a product"}
              </option>

              {heroProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <p className="mt-1 text-xs text-ink-faint">
              Choose a published product to feature in the homepage hero.
            </p>
          </div>
        )}

        {values.heroPreviewType === "VIDEO" && (
          <div>
            <label className="label">Custom preview video</label>

            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="input"
              disabled={saving}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                  setError(null);
                  setSaved(false);
                  setSaving(true);

                  const result = await uploadFile({
                    file,
                    kind: "hero-video",
                    productId: "hero",
                  });

                  if (!result.key) {
                    throw new Error("Upload completed but no video key was returned.");
                  }

                  set("heroPreviewVideoKey", result.key);
                } catch (err) {
                  console.error("Hero preview upload failed:", err);
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Hero preview upload failed."
                  );
                } finally {
                  setSaving(false);
                  e.target.value = "";
                }
              }}
            />

            {values.heroPreviewVideoKey && (
              <p className="mt-2 text-xs text-ink-muted">
                Custom preview video uploaded.
              </p>
            )}

            <p className="mt-1 text-xs text-ink-faint">
              Upload a short vertical video for the homepage hero preview.
            </p>
          </div>
        )}
      </Section>

      <Section title="Social links">
        <Field label="Instagram URL" value={values.instagramUrl} onChange={(v) => set("instagramUrl", v)} />
        <Field label="YouTube URL" value={values.youtubeUrl} onChange={(v) => set("youtubeUrl", v)} />
        <Field label="Facebook URL" value={values.facebookUrl} onChange={(v) => set("facebookUrl", v)} />
      </Section>

      <Section title="Contact & footer">
        <Field label="Contact email" value={values.contactEmail} onChange={(v) => set("contactEmail", v)} />
        <Field label="Footer text" value={values.footerText} onChange={(v) => set("footerText", v)} />
      </Section>

      <Section title="Legal text">
        <TextAreaField label="Default license text" value={values.defaultLicenseText} onChange={(v) => set("defaultLicenseText", v)} rows={4} />
        <TextAreaField label="Terms & Conditions" value={values.termsText} onChange={(v) => set("termsText", v)} rows={6} />
        <TextAreaField label="Privacy Policy" value={values.privacyText} onChange={(v) => set("privacyText", v)} rows={6} />
        <TextAreaField label="Refund & Cancellation Policy" value={values.refundPolicyText} onChange={(v) => set("refundPolicyText", v)} rows={6} />
      </Section>

      <Section title="Maintenance mode">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.maintenanceMode}
            onChange={(e) => set("maintenanceMode", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Enable maintenance mode (hides the storefront from customers; admins can still browse)
        </label>
        <TextAreaField label="Maintenance message" value={values.maintenanceMessage} onChange={(v) => set("maintenanceMessage", v)} rows={2} />
      </Section>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save settings
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 size={16} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
