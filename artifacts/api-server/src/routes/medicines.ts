import { Router } from "express";
import { db } from "@workspace/db";
import { medicinesTable, categoriesTable, suppliersTable } from "@workspace/db/schema";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { z } from "zod/v4";
import { notifyPharmacyDataChanged } from "../realtime/hub";

const router = Router();

function sessionPharmacyId(req: { session?: { pharmacyId?: number } }): number | undefined {
  return (req.session as { pharmacyId?: number } | undefined)?.pharmacyId;
}

const medicineInputSchema = z.object({
  name: z.string().min(2, "Name is required"),
  genericName: z.string().optional(),
  categoryId: z.coerce.number().int().optional(),
  supplierId: z.coerce.number().int().optional(),
  batchNumber: z.string().optional(),
  barcode: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  salePrice: z.coerce.number().min(0, "Sale price is required"),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  minStockLevel: z.coerce.number().int().min(0).default(10),
  unit: z.string().min(1, "Unit is required"),
  expiryDate: z.string().optional(),
  manufacturingDate: z.string().optional(),
  manufacturer: z.string().optional(),
  description: z.string().optional(),
  requiresPrescription: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function normalizeMedicineInput(data: z.infer<typeof medicineInputSchema>) {
  return {
    name: data.name.trim(),
    genericName: data.genericName?.trim() || null,
    categoryId: data.categoryId ?? null,
    supplierId: data.supplierId ?? null,
    batchNumber: data.batchNumber?.trim() || null,
    barcode: data.barcode?.trim() || null,
    purchasePrice:
      typeof data.purchasePrice === "number" ? data.purchasePrice.toFixed(2) : null,
    salePrice: data.salePrice.toFixed(2),
    stockQuantity: data.stockQuantity ?? 0,
    minStockLevel: data.minStockLevel ?? 10,
    unit: data.unit.trim(),
    expiryDate: data.expiryDate?.trim() || null,
    manufacturingDate: data.manufacturingDate?.trim() || null,
    manufacturer: data.manufacturer?.trim() || null,
    description: data.description?.trim() || null,
    requiresPrescription: data.requiresPrescription ?? false,
    isActive: data.isActive ?? true,
  };
}

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
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  conditions.push(eq(medicinesTable.pharmacyId, pharmacyId));

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
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
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
    .where(and(eq(medicinesTable.id, id), eq(medicinesTable.pharmacyId, pharmacyId)));

  if (!medicine) {
    res.status(404).json({ error: "Medicine not found" });
    return;
  }
  res.json(medicine);
});

router.post("/", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = medicineInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid medicine data",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }
  const [medicine] = await db
    .insert(medicinesTable)
    .values({ ...normalizeMedicineInput(parsed.data), pharmacyId })
    .returning();
  const pid = sessionPharmacyId(req);
  if (pid) notifyPharmacyDataChanged(pid);
  res.status(201).json(medicine);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid medicine id" });
    return;
  }
  const parsed = medicineInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid medicine data",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }
  const normalized = normalizeMedicineInput({
    name: parsed.data.name ?? "",
    salePrice: parsed.data.salePrice ?? 0,
    stockQuantity: parsed.data.stockQuantity ?? 0,
    minStockLevel: parsed.data.minStockLevel ?? 10,
    unit: parsed.data.unit ?? "tablets",
    ...parsed.data,
  });
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [medicine] = await db
    .update(medicinesTable)
    .set(
      Object.fromEntries(
        Object.entries(normalized).filter(([k]) => k in parsed.data),
      ) as Partial<typeof normalized>,
    )
    .where(and(eq(medicinesTable.id, id), eq(medicinesTable.pharmacyId, pharmacyId)))
    .returning();
  if (!medicine) {
    res.status(404).json({ error: "Medicine not found" });
    return;
  }
  const pid = sessionPharmacyId(req);
  if (pid) notifyPharmacyDataChanged(pid);
  res.json(medicine);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  await db
    .delete(medicinesTable)
    .where(and(eq(medicinesTable.id, id), eq(medicinesTable.pharmacyId, pharmacyId)));
  const pid = sessionPharmacyId(req);
  if (pid) notifyPharmacyDataChanged(pid);
  res.json({ success: true, message: "Medicine deleted" });
});

export default router;
