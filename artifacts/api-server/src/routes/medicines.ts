import { Router } from "express";
import { db } from "@workspace/db";
import { medicinesTable, categoriesTable, suppliersTable, insertMedicineSchema } from "@workspace/db/schema";
import { eq, ilike, or, sql, and, lte } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { search, categoryId, lowStock } = req.query;

  let query = db
    .select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      genericName: medicinesTable.genericName,
      categoryId: medicinesTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: medicinesTable.supplierId,
      supplierName: suppliersTable.name,
      batchNumber: medicinesTable.batchNumber,
      barcode: medicinesTable.barcode,
      purchasePrice: medicinesTable.purchasePrice,
      salePrice: medicinesTable.salePrice,
      stockQuantity: medicinesTable.stockQuantity,
      minStockLevel: medicinesTable.minStockLevel,
      unit: medicinesTable.unit,
      expiryDate: medicinesTable.expiryDate,
      manufacturingDate: medicinesTable.manufacturingDate,
      manufacturer: medicinesTable.manufacturer,
      description: medicinesTable.description,
      requiresPrescription: medicinesTable.requiresPrescription,
      isActive: medicinesTable.isActive,
      createdAt: medicinesTable.createdAt,
    })
    .from(medicinesTable)
    .leftJoin(categoriesTable, eq(medicinesTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(medicinesTable.supplierId, suppliersTable.id));

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(medicinesTable.name, `%${search}%`),
        ilike(medicinesTable.genericName, `%${search}%`),
        ilike(medicinesTable.barcode, `%${search}%`)
      )
    );
  }

  if (categoryId) {
    conditions.push(eq(medicinesTable.categoryId, parseInt(categoryId as string)));
  }

  if (lowStock === "true") {
    conditions.push(sql`${medicinesTable.stockQuantity} <= ${medicinesTable.minStockLevel}`);
  }

  if (conditions.length > 0) {
    const medicines = await query.where(and(...conditions)).orderBy(medicinesTable.name);
    res.json(medicines);
  } else {
    const medicines = await query.orderBy(medicinesTable.name);
    res.json(medicines);
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [medicine] = await db
    .select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      genericName: medicinesTable.genericName,
      categoryId: medicinesTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: medicinesTable.supplierId,
      supplierName: suppliersTable.name,
      batchNumber: medicinesTable.batchNumber,
      barcode: medicinesTable.barcode,
      purchasePrice: medicinesTable.purchasePrice,
      salePrice: medicinesTable.salePrice,
      stockQuantity: medicinesTable.stockQuantity,
      minStockLevel: medicinesTable.minStockLevel,
      unit: medicinesTable.unit,
      expiryDate: medicinesTable.expiryDate,
      manufacturingDate: medicinesTable.manufacturingDate,
      manufacturer: medicinesTable.manufacturer,
      description: medicinesTable.description,
      requiresPrescription: medicinesTable.requiresPrescription,
      isActive: medicinesTable.isActive,
      createdAt: medicinesTable.createdAt,
    })
    .from(medicinesTable)
    .leftJoin(categoriesTable, eq(medicinesTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(medicinesTable.supplierId, suppliersTable.id))
    .where(eq(medicinesTable.id, id));

  if (!medicine) {
    res.status(404).json({ error: "Medicine not found" });
    return;
  }
  res.json(medicine);
});

router.post("/", async (req, res) => {
  const parsed = insertMedicineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [medicine] = await db.insert(medicinesTable).values(parsed.data).returning();
  res.status(201).json(medicine);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = insertMedicineSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [medicine] = await db.update(medicinesTable).set(parsed.data).where(eq(medicinesTable.id, id)).returning();
  res.json(medicine);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(medicinesTable).where(eq(medicinesTable.id, id));
  res.json({ success: true, message: "Medicine deleted" });
});

export default router;
