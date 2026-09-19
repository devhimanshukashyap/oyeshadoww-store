import { db } from "@/lib/db";

export async function getDashboardStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalRevenue,
    todayRevenue,
    totalOrders,
    todayOrders,
    pendingOrders,
    failedOrders,
    refundedOrders,
    totalCustomers,
    totalProducts,
    totalReels,
    recentOrders,
    recentCustomers,
  ] = await Promise.all([
    db.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmountPaise: true },
    }),

    db.order.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfToday },
      },
      _sum: { totalAmountPaise: true },
    }),

    // Only completed/successful orders count as orders.
    db.order.count({
      where: { status: "PAID" },
    }),

    // Only today's completed/successful orders.
    db.order.count({
      where: {
        status: "PAID",
        paidAt: { gte: startOfToday },
      },
    }),

    // Checkout attempts that have not completed yet.
    db.order.count({
      where: {
        status: {
          in: ["CREATED", "PENDING"],
        },
      },
    }),

    db.order.count({
      where: { status: "FAILED" },
    }),

    db.order.count({
      where: { status: "REFUNDED" },
    }),

    db.user.count({
      where: { role: "CUSTOMER" },
    }),

    db.product.count({
      where: { deletedAt: null },
    }),

    db.reel.count({
      where: { deletedAt: null },
    }),

    // Keep all recent checkout attempts here for history/debugging.
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        items: true,
      },
    }),

    db.user.findMany({
      where: { role: "CUSTOMER" },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    totalRevenuePaise: totalRevenue._sum.totalAmountPaise ?? 0,
    todayRevenuePaise: todayRevenue._sum.totalAmountPaise ?? 0,
    totalOrders,
    todayOrders,
    pendingOrders,
    failedOrders,
    refundedOrders,
    totalCustomers,
    totalProducts,
    totalReels,
    recentOrders,
    recentCustomers,
  };
}