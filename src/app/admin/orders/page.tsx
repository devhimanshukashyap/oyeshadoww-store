import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { OrdersClient } from "@/components/admin/orders-client";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin/login");

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Orders" },
        ]}
      />

      <h1 className="font-display text-2xl font-semibold text-ink">
        Orders
      </h1>

      <div className="mt-6">
        <OrdersClient />
      </div>
    </div>
  );
}