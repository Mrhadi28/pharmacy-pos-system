import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, medicinesTable } from "@workspace/db/schema";
import { eq, gte, lte, sql, and, or } from "drizzle-orm";

const router = Router();

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  switch (period) {
    case "today": break;
    case "week": startDate.setDate(now.getDate() - 7); break;
    case "month": startDate.setMonth(now.getMonth() - 1); break;
    case "year": startDate.setFullYear(now.getFullYear() - 1); break;
    default: startDate.setDate(now.getDate() - 30);
  }
  return { startDate, endDate };
}

router.get("/sales-summary", async (req, res) => {
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const period = (req.query.period as string) || "month";
  const { startDate, endDate } = getDateRange(period);

  const sales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.pharmacyId, pharmacyId),
      gte(salesTable.createdAt, startDate),
      lte(salesTable.createdAt, endDate),
      eq(salesTable.status, "completed"),
    )
  );

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);
  const totalTransactions = sales.length;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const dailyMap = new Map<string, { revenue: number; transactions: number }>();
  for (const sale of sales) {
    const date = sale.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(date) || { revenue: 0, transactions: 0 };
    existing.revenue += parseFloat(sale.paidAmount as string);
    existing.transactions += 1;
    dailyMap.set(date, existing);
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({ totalRevenue, totalTransactions, averageTransaction, dailyBreakdown });
});

router.get("/top-medicines", async (req, res) => {
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const period = (req.query.period as string) || "month";
  const { startDate, endDate } = getDateRange(period);

  const salesInRange = await db.select().from(salesTable).where(
    and(
      eq(salesTable.pharmacyId, pharmacyId),
      gte(salesTable.createdAt, startDate),
      lte(salesTable.createdAt, endDate),
      eq(salesTable.status, "completed"),
    )
  );

  if (salesInRange.length === 0) { res.json([]); return; }

  const medicineMap = new Map<number, { medicineName: string; quantitySold: number; revenue: number }>();
  for (const sale of salesInRange) {
    const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, sale.id));
    for (const item of items) {
      const existing = medicineMap.get(item.medicineId) || { medicineName: item.medicineName, quantitySold: 0, revenue: 0 };
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
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const days = parseInt((req.query.days as string) || "30");
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  const todayStr = today.toISOString().split("T")[0];
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const medicines = await db.select().from(medicinesTable).where(
    and(
      sql`${medicinesTable.expiryDate} IS NOT NULL`,
      eq(medicinesTable.pharmacyId, pharmacyId),
      sql`${medicinesTable.expiryDate} <= ${futureDateStr}`,
      sql`${medicinesTable.expiryDate} >= ${todayStr}`
    )
  ).orderBy(medicinesTable.expiryDate);

  res.json(medicines);
});

router.get("/alerts", async (_req, res) => {
  const pharmacyId = ((_req as any).session as { pharmacyId?: number } | undefined)?.pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const allMedicines = await db.select().from(medicinesTable).where(and(eq(medicinesTable.isActive, true), eq(medicinesTable.pharmacyId, pharmacyId)));

  const lowStock = allMedicines.filter(m => m.stockQuantity <= m.minStockLevel);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);
  const thirtyDaysStr = thirtyDaysLater.toISOString().split("T")[0];

  const expired = allMedicines.filter(m => m.expiryDate && m.expiryDate < todayStr);
  const expiringSoon = allMedicines.filter(m => m.expiryDate && m.expiryDate >= todayStr && m.expiryDate <= thirtyDaysStr);

  // Credit alerts - customers with outstanding balance > 0
  const creditSales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.pharmacyId, pharmacyId),
      or(eq(salesTable.paymentStatus, "credit"), eq(salesTable.paymentStatus, "partial"))!,
    )
  );

  const customerCreditMap = new Map<number, number>();
  for (const sale of creditSales) {
    if (sale.customerId) {
      const existing = customerCreditMap.get(sale.customerId) || 0;
      customerCreditMap.set(sale.customerId, existing + parseFloat(sale.creditAmount as string));
    }
  }

  const { customersTable } = await import("@workspace/db/schema");
  const creditAlerts = await Promise.all(
    Array.from(customerCreditMap.entries())
      .filter(([, outstanding]) => outstanding > 0)
      .map(async ([customerId, outstanding]) => {
        const [cust] = await db.select().from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.pharmacyId, pharmacyId)));
        return { customerId, customerName: cust?.name ?? "Unknown", outstanding };
      })
  );

  res.json({ lowStock, expiringSoon, expired, creditAlerts });
});

export default router;
