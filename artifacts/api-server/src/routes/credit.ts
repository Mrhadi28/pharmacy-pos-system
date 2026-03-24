import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, customersTable, creditPaymentsTable, manualCreditEntriesTable, manualCreditPaymentsTable } from "@workspace/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

const router = Router();

// Get all credit/khata sales
router.get("/", async (req, res) => {
  const { customerId } = req.query;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  const conditions = [
    eq(salesTable.pharmacyId, pharmacyId),
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
        const [cust] = await db
          .select()
          .from(customersTable)
          .where(and(eq(customersTable.id, sale.customerId), eq(customersTable.pharmacyId, pharmacyId)));
        customerName = cust?.name ?? null;
      }
      return { ...sale, items, customerName };
    })
  );

  res.json(result.reverse());
});

// Get all manual credit entries
router.get("/manual", async (req, res) => {
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const entries = await db
    .select()
    .from(manualCreditEntriesTable)
    .where(eq(manualCreditEntriesTable.pharmacyId, pharmacyId))
    .orderBy(manualCreditEntriesTable.createdAt);
  res.json(entries.reverse());
});

// Get single manual credit entry with payment history
router.get("/manual/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [entry] = await db
    .select()
    .from(manualCreditEntriesTable)
    .where(and(eq(manualCreditEntriesTable.id, id), eq(manualCreditEntriesTable.pharmacyId, pharmacyId)));
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const payments = await db.select().from(manualCreditPaymentsTable)
    .where(eq(manualCreditPaymentsTable.entryId, id))
    .orderBy(manualCreditPaymentsTable.createdAt);

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amountPaid as string), 0);
  const outstanding = Math.max(0, parseFloat(entry.amount as string) - totalPaid);

  res.json({ ...entry, payments, totalPaid, outstanding });
});

// Create a manual credit entry
router.post("/manual", async (req, res) => {
  const { customerName, customerId, amount, dueDate, notes, status } = req.body;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  if (!customerName || !amount || parseFloat(amount) <= 0) {
    res.status(400).json({ error: "Customer name and amount are required" });
    return;
  }

  const [entry] = await db.insert(manualCreditEntriesTable).values({
    pharmacyId,
    customerName,
    customerId: customerId ?? null,
    amount: parseFloat(amount).toFixed(2),
    paidAmount: "0",
    dueDate: dueDate ?? null,
    notes: notes ?? null,
    status: status || "unpaid",
  }).returning();

  res.status(201).json(entry);
});

// Record a payment against a manual credit entry
router.post("/manual/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id);
  const { amountPaid, paymentMethod = "cash", notes } = req.body;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  if (!amountPaid || parseFloat(amountPaid) <= 0) {
    res.status(400).json({ error: "Invalid payment amount" });
    return;
  }

  const [entry] = await db
    .select()
    .from(manualCreditEntriesTable)
    .where(and(eq(manualCreditEntriesTable.id, id), eq(manualCreditEntriesTable.pharmacyId, pharmacyId)));
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  // Insert the payment record
  const [payment] = await db.insert(manualCreditPaymentsTable).values({
    entryId: id,
    amountPaid: parseFloat(amountPaid).toFixed(2),
    paymentMethod,
    notes: notes ?? null,
  }).returning();

  // Recalculate total paid from payments table
  const allPayments = await db.select().from(manualCreditPaymentsTable)
    .where(eq(manualCreditPaymentsTable.entryId, id));
  const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amountPaid as string), 0);
  const entryAmount = parseFloat(entry.amount as string);
  const outstanding = Math.max(0, entryAmount - totalPaid);
  const newStatus = outstanding <= 0 ? "paid" : entry.status === "overdue" ? "overdue" : "unpaid";

  // Update entry
  const [updatedEntry] = await db.update(manualCreditEntriesTable).set({
    paidAmount: Math.min(totalPaid, entryAmount).toFixed(2),
    status: newStatus,
    updatedAt: new Date(),
  }).where(eq(manualCreditEntriesTable.id, id)).returning();

  res.json({ ...updatedEntry, payments: allPayments, totalPaid, outstanding, latestPayment: payment });
});

// Update manual credit entry status or notes
router.patch("/manual/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes, dueDate } = req.body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (dueDate !== undefined) updateData.dueDate = dueDate;

  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [entry] = await db
    .update(manualCreditEntriesTable)
    .set(updateData)
    .where(and(eq(manualCreditEntriesTable.id, id), eq(manualCreditEntriesTable.pharmacyId, pharmacyId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(entry);
});

// Delete manual credit entry
router.delete("/manual/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  // Delete payments first (cascade not guaranteed in all setups)
  await db.delete(manualCreditPaymentsTable).where(eq(manualCreditPaymentsTable.entryId, id));
  await db
    .delete(manualCreditEntriesTable)
    .where(and(eq(manualCreditEntriesTable.id, id), eq(manualCreditEntriesTable.pharmacyId, pharmacyId)));
  res.json({ success: true });
});

// Get customer credit summary
router.get("/customer/:customerId", async (req, res) => {
  const customerId = parseInt(req.params.customerId);
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.pharmacyId, pharmacyId)));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const creditSales = await db.select().from(salesTable).where(
    and(
      eq(salesTable.customerId, customerId),
      eq(salesTable.pharmacyId, pharmacyId),
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

// Record a credit payment for a POS sale
router.post("/:saleId/pay", async (req, res) => {
  const saleId = parseInt(req.params.saleId);
  const { amountPaid, paymentMethod = "cash", notes } = req.body;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  if (!amountPaid || amountPaid <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(and(eq(salesTable.id, saleId), eq(salesTable.pharmacyId, pharmacyId)));
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
    }).where(and(eq(customersTable.id, sale.customerId), eq(customersTable.pharmacyId, pharmacyId)));
  }

  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, saleId));
  let customerName = null;
  if (updatedSale.customerId) {
    const [cust] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, updatedSale.customerId), eq(customersTable.pharmacyId, pharmacyId)));
    customerName = cust?.name ?? null;
  }

  res.json({ ...updatedSale, items, customerName });
});

export default router;
