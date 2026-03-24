import { Router } from "express";
import { db } from "@workspace/db";
import { purchasesTable, purchaseItemsTable, suppliersTable, medicinesTable } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { notifyPharmacyDataChanged } from "../realtime/hub";

const router = Router();

function generatePoNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${y}${m}${d}-${random}`;
}

async function getPurchaseWithDetails(purchaseId: number, pharmacyId: number) {
  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(and(eq(purchasesTable.id, purchaseId), eq(purchasesTable.pharmacyId, pharmacyId)));
  if (!purchase) return null;
  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchaseId));
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(and(eq(suppliersTable.id, purchase.supplierId), eq(suppliersTable.pharmacyId, pharmacyId)));
  return { ...purchase, items, supplierName: supplier?.name ?? "Unknown" };
}

router.get("/", async (req, res) => {
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const purchases = await db
    .select()
    .from(purchasesTable)
    .where(eq(purchasesTable.pharmacyId, pharmacyId))
    .orderBy(purchasesTable.createdAt);
  const result = await Promise.all(purchases.map(p => getPurchaseWithDetails(p.id, pharmacyId)));
  res.json(result.filter(Boolean).reverse());
});

router.post("/", async (req, res) => {
  const { supplierId, items, notes, status = "pending" } = req.body;
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Supplier and items are required" });
    return;
  }

  let totalAmount = 0;
  const enrichedItems: Array<{ medicineId: number; medicineName: string; quantity: number; unitCost: number; total: number }> = [];

  for (const item of items) {
    const [medicine] = await db
      .select()
      .from(medicinesTable)
      .where(and(eq(medicinesTable.id, item.medicineId), eq(medicinesTable.pharmacyId, pharmacyId)));
    const medicineName = medicine?.name ?? `Medicine #${item.medicineId}`;
    const total = item.quantity * item.unitCost;
    totalAmount += total;
    enrichedItems.push({ medicineId: item.medicineId, medicineName, quantity: item.quantity, unitCost: item.unitCost, total });
  }

  const [newPurchase] = await db.insert(purchasesTable).values({
    pharmacyId,
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

  const result = await getPurchaseWithDetails(newPurchase.id, pharmacyId);
  if (pharmacyId) notifyPharmacyDataChanged(pharmacyId);
  res.status(201).json(result);
});

// Mark purchase as received and update stock
router.post("/:id/receive", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [purchase] = await db
    .select()
    .from(purchasesTable)
    .where(and(eq(purchasesTable.id, id), eq(purchasesTable.pharmacyId, pharmacyId)));

  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  if (purchase.status === "received") { res.status(400).json({ error: "Purchase already received" }); return; }
  if (purchase.status === "cancelled") { res.status(400).json({ error: "Cannot receive a cancelled purchase" }); return; }

  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));

  // Update stock for each item
  for (const item of items) {
    await db.update(medicinesTable).set({
      stockQuantity: sql`${medicinesTable.stockQuantity} + ${item.quantity}`,
    }).where(and(eq(medicinesTable.id, item.medicineId), eq(medicinesTable.pharmacyId, pharmacyId)));
  }

  // Mark purchase as received
  await db
    .update(purchasesTable)
    .set({ status: "received" })
    .where(and(eq(purchasesTable.id, id), eq(purchasesTable.pharmacyId, pharmacyId)));

  const result = await getPurchaseWithDetails(id, pharmacyId);
  if (pharmacyId) notifyPharmacyDataChanged(pharmacyId);
  res.json(result);
});

export default router;
