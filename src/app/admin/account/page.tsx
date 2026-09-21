import { requireAdmin } from "@/lib/session";
import { getAdminAccount } from "@/server/services/account.service";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AdminChangePassword } from "@/components/admin/admin-change-password";
import { AdminChangeEmail } from "@/components/admin/admin-change-email";

export default async function AdminAccountPage() {
  const user = await requireAdmin();
  const account = await getAdminAccount(user.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Account" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Admin Account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your administrator profile and security settings.
        </p>
      </div>

      <section className="card space-y-5">
        <div>
          <h2 className="text-lg font-medium text-ink">Profile</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your administrator account details.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-muted">Name</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {account.name || "Not set"}
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-muted">Email</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {account.email}
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-muted">Role</p>
            <p className="mt-1 text-sm font-medium text-ink">
              Administrator
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-muted">Account created</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {account.createdAt.toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-5">
        <div>
          <h2 className="text-lg font-medium text-ink">Security</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your admin account requires email verification during every login.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">
                Email OTP authentication
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Mandatory for administrator sign-in.
              </p>
            </div>

            <span className="rounded-pill bg-success/15 px-3 py-1 text-xs font-medium text-success">
              Enabled
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-muted">Last successful login</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {account.lastLoginAt
                ? account.lastLoginAt.toLocaleString("en-IN")
                : "Not available"}
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-muted">Login failures</p>
            <p className="mt-1 text-sm font-medium text-ink">
              {account.failedLoginCount}
            </p>
          </div>
        </div>
      </section>
      <AdminChangePassword />
      <AdminChangeEmail currentEmail={account.email} />
    </div>
  );
}