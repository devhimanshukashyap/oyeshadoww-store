import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

/**
 * Server-side admin chrome. Route protection itself is enforced by
 * middleware.ts (redirects unauthenticated/non-admin requests to
 * /admin/login before this layout even renders) AND independently by
 * requireAdmin() inside every /api/admin/* route and admin page — see
 * docs/SECURITY.md "Defense in depth." This layout only decides whether
 * to show the sidebar/topbar chrome (admin session) or render the bare
 * page (the /admin/login route, reachable without a session).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user?.role !== "ADMIN") {
    return <div className="min-h-screen bg-base">{children}</div>;
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-base">
      <div className="flex">
        <AdminSidebar brandHandle={settings.brandHandle} />
        <div className="flex min-h-screen flex-1 flex-col md:ml-64">
          <AdminTopbar brandHandle={settings.brandHandle} />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
