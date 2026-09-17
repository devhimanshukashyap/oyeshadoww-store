import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { Wrench } from "lucide-react";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  const bypassMaintenance = user?.role === "ADMIN";

  if (settings.maintenanceMode && !bypassMaintenance) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised text-accent">
          <Wrench size={24} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">{settings.brandHandle}</h1>
        <p className="max-w-sm text-ink-muted">{settings.maintenanceMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
