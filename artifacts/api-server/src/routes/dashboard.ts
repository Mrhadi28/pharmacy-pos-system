import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, medicinesTable, customersTable } from "@workspace/db/schema";
import { eq, gte, lte, and, or, inArray } from "drizzle-orm";

const router = Router();

function getFilterDates(filter?: string, from?: string, to?: string): { startDate: Date; endDate: Date } {
  const now = new Date();

  // If explicit from/to provided, use them (takes priority)
  if (from || to) {
    const startDate = from ? new Date(from) : new Date(0);
    startDate.setHours(0, 0, 0, 0);
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  switch (filter) {
    case "today":
      break;
    case "yesterday": {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    default:
      // "today" is default
      break;
  }

  return { startDate, endDate };
}

router.get("/stats", async (req, res) => {
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const now = new Date();
  const filter = req.query.filter as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const { startDate, endDate } = getFilterDates(filter, from, to);

  const filteredSales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.pharmacyId, pharmacyId),
      gte(salesTable.createdAt, startDate),
      lte(salesTable.createdAt, endDate),
      eq(salesTable.status, "completed"),
    )
  );

  const filteredRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);
  const filteredTransactions = filteredSales.length;
  const avgOrderValue = filteredTransactions > 0 ? filteredRevenue / filteredTransactions : 0;

  const allMedicines = await db
    .select()
    .from(medicinesTable)
    .where(eq(medicinesTable.pharmacyId, pharmacyId));
  const totalMedicines = allMedicines.length;
  const lowStockCount = allMedicines.filter(m => m.stockQuantity <= m.minStockLevel).length;

  const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(now.getDate() + 30);
  const futureDateStr = thirtyDaysFromNow.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];
  const expiringCount = allMedicines.filter(m => m.expiryDate && m.expiryDate >= todayStr && m.expiryDate <= futureDateStr).length;

  const creditSales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.pharmacyId, pharmacyId),
      or(eq(salesTable.paymentStatus, "credit"), eq(salesTable.paymentStatus, "partial"))!,
    )
  );
  const totalCreditOutstanding = creditSales.reduce((sum, s) => sum + parseFloat(s.creditAmount as string || "0"), 0);

  // Fetch recent sales with batched item/customer lookups (avoids N+1 queries).
  const recentSalesRaw = await db.select().from(salesTable)
    .where(and(eq(salesTable.pharmacyId, pharmacyId), gte(salesTable.createdAt, startDate), lte(salesTable.createdAt, endDate)))
    .orderBy(salesTable.createdAt)
    .limit(20);
  const recentSaleIds = recentSalesRaw.map((sale) => sale.id);
  const recentItems = recentSaleIds.length
    ? await db.select().from(saleItemsTable).where(inArray(saleItemsTable.saleId, recentSaleIds))
    : [];
  const itemsBySaleId = new Map<number, typeof recentItems>();
  for (const item of recentItems) {
    const list = itemsBySaleId.get(item.saleId) ?? [];
    list.push(item);
    itemsBySaleId.set(item.saleId, list);
  }

  const customerIds = Array.from(new Set(recentSalesRaw.map((sale) => sale.customerId).filter((id): id is number => Boolean(id))));
  const customers = customerIds.length
    ? await db
        .select({ id: customersTable.id, name: customersTable.name })
        .from(customersTable)
        .where(inArray(customersTable.id, customerIds))
    : [];
  const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

  const recentSales = recentSalesRaw.reverse().map((sale) => ({
    ...sale,
    items: itemsBySaleId.get(sale.id) ?? [],
    customerName: sale.customerId ? (customerNameById.get(sale.customerId) ?? null) : null,
  }));

  res.json({
    todaySales: filteredRevenue,
    todayTransactions: filteredTransactions,
    avgOrderValue,
    totalMedicines,
    lowStockCount,
    expiringCount,
    monthlyRevenue: filteredRevenue,
    weeklyRevenue: filteredRevenue,
    totalCreditOutstanding,
    recentSales,
    filter: filter || (from || to ? "custom" : "today"),
  });
});

export default router;
