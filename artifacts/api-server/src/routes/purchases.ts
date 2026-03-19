import { Router } from "express";
import { db } from "@workspace/db";
import { purchasesTable, purchaseItemsTable, suppliersTable, medicinesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

function generatePoNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${y}${m}${d}-${random}`;
}

async function getPurchaseWithDetails(purchaseId: number) {
  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId));
  if (!purchase) return null;
  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchaseId));
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, purchase.supplierId));
  return { ...purchase, items, supplierName: supplier?.name ?? "Unknown" };
}

router.get("/", async (_req, res) => {
  const purchases = await db.select().from(purchasesTable).orderBy(purchasesTable.createdAt);
  const result = await Promise.all(purchases.map(p => getPurchaseWithDetails(p.id)));
  res.json(result.filter(Boolean).reverse());
});

router.post("/", async (req, res) => {
  const { supplierId, items, notes, status = "pending" } = req.body;
  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Supplier and items are required" });
    return;
  }

  let totalAmount = 0;
  const enrichedItems: Array<{ medicineId: number; medicineName: string; quantity: number; unitCost: number; total: number }> = [];

  for (const item of items) {
    const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, item.medicineId));
    const medicineName = medicine?.name ?? `Medicine #${item.medicineId}`;
    const total = item.quantity * item.unitCost;
    totalAmount += total;
    enrichedItems.push({ medicineId: item.medicineId, medicineName, quantity: item.quantity, unitCost: item.unitCost, total });
  }

  const [newPurchase] = await db.insert(purchasesTable).values({
    poNumber: generatePoNumber(),
    supplierId,
    totalAmount: totalAmount.toFixed(2),
    status,
    notes: notes ?? null,
  }).returning();

  const purchaseItemsData = enrichedItems.map(item => ({
    purchaseId: newPurchase.id,
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    quantity: item.quantity,
    unitCost: item.unitCost.toFixed(2),
    total: item.total.toFixed(2),
  }));

  await db.insert(purchaseItemsTable).values(purchaseItemsData);

  // If received immediately, update stock
  if (status === "received") {
    for (const item of enrichedItems) {
      await db.update(medicinesTable).set({
        stockQuantity: sql`${medicinesTable.stockQuantity} + ${item.quantity}`,
      }).where(eq(medicinesTable.id, item.medicineId));
    }
  }

  const result = await getPurchaseWithDetails(newPurchase.id);
  res.status(201).json(result);
});

// Mark purchase as received and update stock
router.post("/:id/receive", async (req, res) => {
  const id = parseInt(req.params.id);
  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));

  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  if (purchase.status === "received") { res.status(400).json({ error: "Purchase already received" }); return; }
  if (purchase.status === "cancelled") { res.status(400).json({ error: "Cannot receive a cancelled purchase" }); return; }

  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));

  // Update stock for each item
  for (const item of items) {
    await db.update(medicinesTable).set({
      stockQuantity: sql`${medicinesTable.stockQuantity} + ${item.quantity}`,
    }).where(eq(medicinesTable.id, item.medicineId));
  }

  // Mark purchase as received
  await db.update(purchasesTable).set({ status: "received" }).where(eq(purchasesTable.id, id));

  const result = await getPurchaseWithDetails(id);
  res.json(result);
});

export default router;
