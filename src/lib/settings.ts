import { db } from "@/lib/db";

/**
 * All admin-editable, non-secret site configuration lives in the
 * SiteSetting table (key -> JSON value) instead of being hardcoded across
 * components. Edit these from /admin/settings — no code changes needed.
 *
 * DEFAULT_SETTINGS is only the fallback used before the admin has saved a
 * value (e.g. right after a fresh install) or if a key is missing.
 */
export interface SiteSettings {
  siteName: string;
  brandHandle: string;
  logoKey: string | null;
  faviconKey: string | null;
  tagline: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  contactEmail: string;
  currency: string;
  footerText: string;
  defaultLicenseText: string;
  termsText: string;
  privacyText: string;
  refundPolicyText: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "oyeshadoww",
  brandHandle: "@oyeshadoww",
  logoKey: null,
  faviconKey: null,
  tagline: "AI-made reels, ready to post.",
  instagramUrl: "https://instagram.com/oyeshadoww",
  youtubeUrl: "https://youtube.com/@oyeshadoww",
  facebookUrl: "https://facebook.com/oyeshadoww",
  contactEmail: "hello@oyeshadoww.com",
  currency: "INR",
  footerText: "© oyeshadoww. All rights reserved.",
  defaultLicenseText:
    "You may use purchased reels in your own social media content (Instagram, YouTube, Facebook, TikTok, etc.). " +
    "You may not resell the raw files, redistribute the bundle as-is, publish the archive for others to download, " +
    "or claim exclusive ownership of the underlying content. Replace this placeholder with your finalized terms " +
    "in Admin → Settings → Legal.",
  termsText: "Placeholder Terms & Conditions. Edit this from Admin → Settings → Legal.",
  privacyText: "Placeholder Privacy Policy. Edit this from Admin → Settings → Legal.",
  refundPolicyText:
    "Placeholder Refund & Cancellation Policy. Digital products are generally non-refundable once downloaded; " +
    "edit this from Admin → Settings → Legal to reflect your actual policy.",
  maintenanceMode: false,
  maintenanceMessage: "We'll be back shortly. Thanks for your patience.",
};

let cache: { value: SiteSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // short TTL: admin edits should show up quickly, no redeploy needed

// Small helper so the loop below can assign a dynamically-keyed property
// without TypeScript collapsing the union of possible value types to
// `never` (a known TypeScript limitation with `obj[genericKey] = value`
// inside a loop over `keyof T`) — binding K at a function call site
// avoids it, unlike a bare indexed assignment expression.
function assignSetting<K extends keyof SiteSettings>(target: SiteSettings, key: K, value: SiteSettings[K]) {
  target[key] = value;
}

export async function getSettings(): Promise<SiteSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await db.siteSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const merged = { ...DEFAULT_SETTINGS } as SiteSettings;
  (Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]).forEach((key) => {
    if (map.has(key)) {
      assignSetting(merged, key, map.get(key) as SiteSettings[typeof key]);
    }
  });

  cache = { value: merged, expiresAt: Date.now() + CACHE_TTL_MS };
  return merged;
}

export async function updateSettings(partial: Partial<SiteSettings>): Promise<void> {
  const entries = Object.entries(partial) as [keyof SiteSettings, unknown][];
  await db.$transaction(
    entries.map(([key, value]) =>
      db.siteSetting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      })
    )
  );
  cache = null; // invalidate so the next read picks up fresh values
}
