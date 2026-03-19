import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, medicinesTable } from "@workspace/db/schema";
import { eq, gte, lte, and, or } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  const now = new Date();

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setMonth(now.getMonth() - 1);

  const todaySales = await db.select().from(salesTable).where(
    and(gte(salesTable.createdAt, todayStart), lte(salesTable.createdAt, todayEnd), eq(salesTable.status, "completed"))
  );

  const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);

  const weeklySales = await db.select().from(salesTable).where(
    and(gte(salesTable.createdAt, weekStart), eq(salesTable.status, "completed"))
  );
  const weeklyRevenue = weeklySales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);

  const monthlySales = await db.select().from(salesTable).where(
    and(gte(salesTable.createdAt, monthStart), eq(salesTable.status, "completed"))
  );
  const monthlyRevenue = monthlySales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);

  const allMedicines = await db.select().from(medicinesTable);
  const totalMedicines = allMedicines.length;
  const lowStockCount = allMedicines.filter(m => m.stockQuantity <= m.minStockLevel).length;

  const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(now.getDate() + 30);
  const futureDateStr = thirtyDaysFromNow.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];
  const expiringCount = allMedicines.filter(m => m.expiryDate && m.expiryDate >= todayStr && m.expiryDate <= futureDateStr).length;

  // Credit outstanding
  const creditSales = await db.select().from(salesTable).where(
    or(eq(salesTable.paymentStatus, "credit"), eq(salesTable.paymentStatus, "partial"))!
  );
  const totalCreditOutstanding = creditSales.reduce((sum, s) => sum + parseFloat(s.creditAmount as string || "0"), 0);

  const recentSalesRaw = await db.select().from(salesTable).orderBy(salesTable.createdAt).limit(10);
  const recentSales = recentSalesRaw.reverse().map(s => ({ ...s, items: [], customerName: null }));

  res.json({
    todaySales: todayRevenue,
    todayTransactions: todaySales.length,
    totalMedicines,
    lowStockCount,
    expiringCount,
    monthlyRevenue,
    weeklyRevenue,
    totalCreditOutstanding,
    recentSales,
  });
});

export default router;
