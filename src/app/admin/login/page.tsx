import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Logo } from "@/components/logo";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={40} showWordmark={false} iconOnlyLabel={settings.brandHandle} />
          <p className="mt-3 font-display text-lg font-semibold text-ink">{settings.brandHandle}</p>
          <p className="text-sm text-ink-muted">Admin Portal</p>
        </div>

        <div className="card mt-6 p-6">
          <h1 className="font-display text-xl font-semibold text-ink">Sign in</h1>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
