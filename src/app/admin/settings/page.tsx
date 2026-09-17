import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  const settings = await getSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Branding, social links, and legal text — changes apply site-wide immediately, no redeploy needed.
      </p>
      <div className="mt-6 space-y-6">
        <CategoriesManager />
        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
