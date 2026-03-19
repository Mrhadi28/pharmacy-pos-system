import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, medicinesTable } from "@workspace/db/schema";
import { eq, gte, lte, sql, and } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  const now = new Date();

  // Today's range
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Weekly range
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  // Monthly range
  const monthStart = new Date(now);
  monthStart.setMonth(now.getMonth() - 1);

  // Today's sales
  const todaySales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.createdAt, todayStart),
        lte(salesTable.createdAt, todayEnd),
        eq(salesTable.status, "completed")
      )
    );

  const todayRevenue = todaySales.reduce(
    (sum, s) => sum + parseFloat(s.totalAmount as string),
    0
  );

  // Weekly revenue
  const weeklySales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.createdAt, weekStart),
        eq(salesTable.status, "completed")
      )
    );
  const weeklyRevenue = weeklySales.reduce(
    (sum, s) => sum + parseFloat(s.totalAmount as string),
    0
  );

  // Monthly revenue
  const monthlySales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.createdAt, monthStart),
        eq(salesTable.status, "completed")
      )
    );
  const monthlyRevenue = monthlySales.reduce(
    (sum, s) => sum + parseFloat(s.totalAmount as string),
    0
  );

  // Medicine stats
  const allMedicines = await db.select().from(medicinesTable);
  const totalMedicines = allMedicines.length;

  const lowStockCount = allMedicines.filter(
    (m) => m.stockQuantity <= m.minStockLevel
  ).length;

  // Expiring in 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  const futureDateStr = thirtyDaysFromNow.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const expiringCount = allMedicines.filter(
    (m) =>
      m.expiryDate &&
      m.expiryDate >= todayStr &&
      m.expiryDate <= futureDateStr
  ).length;

  // Recent sales (last 10)
  const recentSalesRaw = await db
    .select()
    .from(salesTable)
    .orderBy(salesTable.createdAt)
    .limit(10);

  const recentSales = recentSalesRaw.reverse().map((s) => ({
    ...s,
    items: [],
    customerName: null,
  }));

  res.json({
    todaySales: todayRevenue,
    todayTransactions: todaySales.length,
    totalMedicines,
    lowStockCount,
    expiringCount,
    monthlyRevenue,
    weeklyRevenue,
    recentSales,
  });
});

export default router;
