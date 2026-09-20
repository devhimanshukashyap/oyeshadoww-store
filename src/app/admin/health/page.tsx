import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getHealthSnapshot } from "@/server/services/health.service";
import { HealthDashboard } from "@/components/admin/health-dashboard";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata: Metadata = { title: "System Health", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  const snapshot = await getHealthSnapshot();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "System Health" },
        ]}
      />
      <h1 className="font-display text-2xl font-semibold text-ink">System Health</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Live checks against each dependency, plus recent activity — nothing here is reported healthy without
        actually being verified.
      </p>

      <div className="mt-6">
        <HealthDashboard initialSnapshot={snapshot} />
      </div>
    </div>
  );
}
