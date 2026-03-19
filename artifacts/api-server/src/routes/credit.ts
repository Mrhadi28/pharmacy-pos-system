import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, customersTable, creditPaymentsTable } from "@workspace/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

const router = Router();

// Get all credit/khata sales
router.get("/", async (req, res) => {
  const { customerId } = req.query;

  const conditions = [
    or(eq(salesTable.paymentStatus, "credit"), eq(salesTable.paymentStatus, "partial"))!
  ];

  if (customerId) {
    conditions.push(eq(salesTable.customerId, parseInt(customerId as string)));
  }

  const sales = await db.select().from(salesTable).where(and(...conditions)).orderBy(salesTable.createdAt);

  const result = await Promise.all(
    sales.map(async (sale) => {
      const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, sale.id));
      let customerName = null;
      if (sale.customerId) {
        const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId));
        customerName = cust?.name ?? null;
      }
      return { ...sale, items, customerName };
    })
  );

  res.json(result.reverse());
});

// Get customer credit summary
router.get("/customer/:customerId", async (req, res) => {
  const customerId = parseInt(req.params.customerId);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const creditSales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.customerId, customerId),
      or(eq(salesTable.paymentStatus, "credit"), eq(salesTable.paymentStatus, "partial"))!
    )
  );

  const totalCredit = creditSales.reduce((sum, s) => sum + parseFloat(s.totalAmount as string), 0);
  const totalPaid = creditSales.reduce((sum, s) => sum + parseFloat(s.paidAmount as string), 0);
  const outstanding = totalCredit - totalPaid;

  const salesWithItems = await Promise.all(
    creditSales.map(async (sale) => {
      const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, sale.id));
      return { ...sale, items, customerName: customer.name };
    })
  );

  res.json({
    customerId,
    customerName: customer.name,
    totalCredit,
    totalPaid,
    outstanding,
    sales: salesWithItems,
  });
});

// Record a credit payment
router.post("/:saleId/pay", async (req, res) => {
  const saleId = parseInt(req.params.saleId);
  const { amountPaid, paymentMethod = "cash", notes } = req.body;

  if (!amountPaid || amountPaid <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const currentPaid = parseFloat(sale.paidAmount as string);
  const total = parseFloat(sale.totalAmount as string);
  const newPaid = Math.min(currentPaid + amountPaid, total);
  const newCredit = Math.max(0, total - newPaid);
  const newStatus = newCredit <= 0 ? "paid" : "partial";

  // Record payment
  if (sale.customerId) {
    await db.insert(creditPaymentsTable).values({
      saleId,
      customerId: sale.customerId,
      amountPaid: amountPaid.toFixed(2),
      paymentMethod,
      notes: notes ?? null,
    });
  }

  // Update sale
  const [updatedSale] = await db.update(salesTable).set({
    paidAmount: newPaid.toFixed(2),
    creditAmount: newCredit.toFixed(2),
    paymentStatus: newStatus,
  }).where(eq(salesTable.id, saleId)).returning();

  // Update customer total purchases if now fully paid
  if (sale.customerId && newStatus === "paid" && sale.paymentStatus !== "paid") {
    await db.update(customersTable).set({
      totalPurchases: sql`${customersTable.totalPurchases} + ${amountPaid}`,
    }).where(eq(customersTable.id, sale.customerId));
  }

  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, saleId));
  let customerName = null;
  if (updatedSale.customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, updatedSale.customerId));
    customerName = cust?.name ?? null;
  }

  res.json({ ...updatedSale, items, customerName });
});

export default router;
