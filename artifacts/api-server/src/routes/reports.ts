import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, medicinesTable } from "@workspace/db/schema";
import { eq, gte, lte, sql, and } from "drizzle-orm";

const router = Router();

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  switch (period) {
    case "today":
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { startDate, endDate };
}

router.get("/sales-summary", async (req, res) => {
  const period = (req.query.period as string) || "month";
  const { startDate, endDate } = getDateRange(period);

  const sales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.createdAt, startDate),
        lte(salesTable.createdAt, endDate),
        eq(salesTable.status, "completed")
      )
    );

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount as string), 0);
  const totalTransactions = sales.length;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Build daily breakdown
  const dailyMap = new Map<string, { revenue: number; transactions: number }>();

  for (const sale of sales) {
    const date = sale.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(date) || { revenue: 0, transactions: 0 };
    existing.revenue += parseFloat(sale.totalAmount as string);
    existing.transactions += 1;
    dailyMap.set(date, existing);
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({ totalRevenue, totalTransactions, averageTransaction, dailyBreakdown });
});

router.get("/top-medicines", async (req, res) => {
  const period = (req.query.period as string) || "month";
  const { startDate, endDate } = getDateRange(period);

  const salesInRange = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.createdAt, startDate),
        lte(salesTable.createdAt, endDate),
        eq(salesTable.status, "completed")
      )
    );

  if (salesInRange.length === 0) {
    res.json([]);
    return;
  }

  const saleIds = salesInRange.map((s) => s.id);

  // Aggregate by medicine
  const medicineMap = new Map<
    number,
    { medicineName: string; quantitySold: number; revenue: number }
  >();

  for (const saleId of saleIds) {
    const items = await db
      .select()
      .from(saleItemsTable)
      .where(eq(saleItemsTable.saleId, saleId));

    for (const item of items) {
      const existing = medicineMap.get(item.medicineId) || {
        medicineName: item.medicineName,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += item.quantity;
      existing.revenue += parseFloat(item.total as string);
      medicineMap.set(item.medicineId, existing);
    }
  }

  const topMedicines = Array.from(medicineMap.entries())
    .map(([medicineId, data]) => ({ medicineId, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json(topMedicines);
});

router.get("/expiring-medicines", async (req, res) => {
  const days = parseInt((req.query.days as string) || "30");
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const todayStr = today.toISOString().split("T")[0];
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const medicines = await db
    .select()
    .from(medicinesTable)
    .where(
      and(
        sql`${medicinesTable.expiryDate} IS NOT NULL`,
        sql`${medicinesTable.expiryDate} <= ${futureDateStr}`,
        sql`${medicinesTable.expiryDate} >= ${todayStr}`
      )
    )
    .orderBy(medicinesTable.expiryDate);

  res.json(medicines);
});

export default router;
