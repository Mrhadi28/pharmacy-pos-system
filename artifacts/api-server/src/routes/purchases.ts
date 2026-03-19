import { Router } from "express";
import { db } from "@workspace/db";
import {
  purchasesTable,
  purchaseItemsTable,
  suppliersTable,
  medicinesTable,
} from "@workspace/db/schema";
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

router.get("/", async (_req, res) => {
  const purchases = await db.select().from(purchasesTable).orderBy(purchasesTable.createdAt);

  const result = await Promise.all(
    purchases.map(async (purchase) => {
      const items = await db
        .select()
        .from(purchaseItemsTable)
        .where(eq(purchaseItemsTable.purchaseId, purchase.id));
      const [supplier] = await db
        .select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, purchase.supplierId));
      return { ...purchase, items, supplierName: supplier?.name ?? "Unknown" };
    })
  );

  res.json(result.reverse());
});

router.post("/", async (req, res) => {
  const { supplierId, items, notes, status = "pending" } = req.body;

  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Supplier and items are required" });
    return;
  }

  let totalAmount = 0;
  const enrichedItems: Array<{
    medicineId: number;
    medicineName: string;
    quantity: number;
    unitCost: number;
    total: number;
  }> = [];

  for (const item of items) {
    const [medicine] = await db
      .select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, item.medicineId));

    const medicineName = medicine?.name ?? `Medicine #${item.medicineId}`;
    const total = item.quantity * item.unitCost;
    totalAmount += total;

    enrichedItems.push({
      medicineId: item.medicineId,
      medicineName,
      quantity: item.quantity,
      unitCost: item.unitCost,
      total,
    });
  }

  const [newPurchase] = await db
    .insert(purchasesTable)
    .values({
      poNumber: generatePoNumber(),
      supplierId,
      totalAmount: totalAmount.toFixed(2),
      status,
      notes: notes ?? null,
    })
    .returning();

  const purchaseItemsData = enrichedItems.map((item) => ({
    purchaseId: newPurchase.id,
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    quantity: item.quantity,
    unitCost: item.unitCost.toFixed(2),
    total: item.total.toFixed(2),
  }));

  const insertedItems = await db.insert(purchaseItemsTable).values(purchaseItemsData).returning();

  // If received, update stock
  if (status === "received") {
    for (const item of enrichedItems) {
      await db
        .update(medicinesTable)
        .set({ stockQuantity: sql`${medicinesTable.stockQuantity} + ${item.quantity}` })
        .where(eq(medicinesTable.id, item.medicineId));
    }
  }

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));

  res.status(201).json({
    ...newPurchase,
    items: insertedItems,
    supplierName: supplier?.name ?? "Unknown",
  });
});

export default router;
