"use client";

import { useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [values, setValues] = useState<SiteSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

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
