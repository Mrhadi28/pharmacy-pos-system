import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesTable,
  saleItemsTable,
  medicinesTable,
  customersTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, or } from "drizzle-orm";
import { notifyPharmacyDataChanged } from "../realtime/hub";

const router = Router();

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}${d}-${random}`;
}

router.get("/", async (req, res) => {
  const { startDate, endDate, customerId, paymentStatus } = req.query;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const conditions = [eq(salesTable.pharmacyId, pharmacyId)];
  if (startDate) conditions.push(gte(salesTable.createdAt, new Date(startDate as string)));
  if (endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(salesTable.createdAt, end));
  }
  if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId as string)));
  if (paymentStatus) conditions.push(eq(salesTable.paymentStatus, paymentStatus as string));

  const salesRows = conditions.length
    ? await db.select().from(salesTable).where(and(...conditions)).orderBy(salesTable.createdAt)
    : await db.select().from(salesTable).orderBy(salesTable.createdAt);

  const result = await Promise.all(
    salesRows.map(async (sale) => {
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

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [sale] = await db
    .select()
    .from(salesTable)
    .where(and(eq(salesTable.id, id), eq(salesTable.pharmacyId, pharmacyId)));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  let customerName = null;
  if (sale.customerId) {
    const [cust] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, sale.customerId), eq(customersTable.pharmacyId, pharmacyId)));
    customerName = cust?.name ?? null;
  }
  res.json({ ...sale, items, customerName });
});

router.post("/", async (req, res) => {
  const { customerId, items, discount = 0, paidAmount, paymentMethod, notes } = req.body;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Items are required" });
    return;
  }

  const enrichedItems: Array<{
    medicineId: number;
    medicineName: string;
    medicineUnit: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }> = [];

  let subtotal = 0;

  for (const item of items) {
    const [medicine] = await db
      .select()
      .from(medicinesTable)
      .where(and(eq(medicinesTable.id, item.medicineId), eq(medicinesTable.pharmacyId, pharmacyId)));
    if (!medicine) { res.status(400).json({ error: `Medicine ${item.medicineId} not found` }); return; }
    if (medicine.stockQuantity < item.quantity) { res.status(400).json({ error: `Insufficient stock for ${medicine.name}. Available: ${medicine.stockQuantity} ${medicine.unit}` }); return; }

    const unitPrice = parseFloat(medicine.salePrice as string);
    const itemDiscount = item.discount ?? 0;
    const total = unitPrice * item.quantity - itemDiscount;
    subtotal += total;

    enrichedItems.push({
      medicineId: item.medicineId,
      medicineName: medicine.name,
      medicineUnit: medicine.unit,
      quantity: item.quantity,
      unitPrice,
      discount: itemDiscount,
      total,
    });
  }

  const discountAmount = parseFloat(discount) || 0;
  const tax = 0;
  const totalAmount = subtotal - discountAmount + tax;
  const paidAmt = parseFloat(paidAmount);

  // Determine payment status
  let paymentStatus = "paid";
  let creditAmount = 0;
  let changeAmount = 0;

  if (paymentMethod === "credit") {
    paymentStatus = "credit";
    creditAmount = totalAmount;
    changeAmount = 0;
  } else if (paidAmt < totalAmount) {
    paymentStatus = "partial";
    creditAmount = totalAmount - paidAmt;
    changeAmount = 0;
  } else {
    paymentStatus = "paid";
    creditAmount = 0;
    changeAmount = Math.max(0, paidAmt - totalAmount);
  }

  const [newSale] = await db.insert(salesTable).values({
    pharmacyId,
    invoiceNumber: generateInvoiceNumber(),
    customerId: customerId ?? null,
    subtotal: subtotal.toFixed(2),
    discount: discountAmount.toFixed(2),
    tax: tax.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    paidAmount: paymentMethod === "credit" ? "0.00" : paidAmt.toFixed(2),
    changeAmount: changeAmount.toFixed(2),
    creditAmount: creditAmount.toFixed(2),
    paymentStatus,
    paymentMethod: paymentMethod === "credit" ? "cash" : paymentMethod,
    status: "completed",
    notes: notes ?? null,
  }).returning();

  const saleItemsData = enrichedItems.map((item) => ({
    saleId: newSale.id,
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    medicineUnit: item.medicineUnit,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    discount: item.discount.toFixed(2),
    total: item.total.toFixed(2),
  }));

  const insertedItems = await db.insert(saleItemsTable).values(saleItemsData).returning();

  // Reduce stock
  for (const item of enrichedItems) {
    await db.update(medicinesTable).set({
      stockQuantity: sql`${medicinesTable.stockQuantity} - ${item.quantity}`,
    }).where(eq(medicinesTable.id, item.medicineId));
  }

  // Update customer stats (only for paid transactions)
  if (customerId && paymentStatus === "paid") {
    await db.update(customersTable).set({
      totalPurchases: sql`${customersTable.totalPurchases} + ${totalAmount}`,
      visitCount: sql`${customersTable.visitCount} + 1`,
    }).where(and(eq(customersTable.id, customerId), eq(customersTable.pharmacyId, pharmacyId)));
  } else if (customerId) {
    // Still count the visit
    await db.update(customersTable).set({
      visitCount: sql`${customersTable.visitCount} + 1`,
    }).where(and(eq(customersTable.id, customerId), eq(customersTable.pharmacyId, pharmacyId)));
  }

  let customerName = null;
  if (customerId) {
    const [cust] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, customerId), eq(customersTable.pharmacyId, pharmacyId)));
    customerName = cust?.name ?? null;
  }

  if (pharmacyId) notifyPharmacyDataChanged(pharmacyId);

  res.status(201).json({ ...newSale, items: insertedItems, customerName });
});

export default router;
