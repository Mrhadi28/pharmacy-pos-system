import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, insertSupplierSchema } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();
const sessionPharmacyId = (req: any): number | undefined => req.session?.pharmacyId;

router.get("/", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.pharmacyId, pharmacyId))
    .orderBy(suppliersTable.name);
  res.json(suppliers);
});

router.post("/", async (req, res) => {
  const parsed = insertSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [supplier] = await db
    .insert(suppliersTable)
    .values({ ...parsed.data, pharmacyId })
    .returning();
  res.status(201).json(supplier);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = insertSupplierSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [supplier] = await db
    .update(suppliersTable)
    .set(parsed.data)
    .where(and(eq(suppliersTable.id, id), eq(suppliersTable.pharmacyId, pharmacyId)))
    .returning();
  res.json(supplier);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  await db
    .delete(suppliersTable)
    .where(and(eq(suppliersTable.id, id), eq(suppliersTable.pharmacyId, pharmacyId)));
  res.json({ success: true, message: "Supplier deleted" });
});

export default router;
