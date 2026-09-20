import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CustomersClient } from "@/components/admin/customers-client";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Customers" },
        ]}
      />

      <h1 className="font-display text-2xl font-semibold text-ink">
        Customers
      </h1>

      <div className="mt-6">
        <CustomersClient />
      </div>
    </div>
  );
}