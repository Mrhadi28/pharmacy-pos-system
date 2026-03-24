import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, insertCategorySchema } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();
const sessionPharmacyId = (req: any): number | undefined => req.session?.pharmacyId;

router.get("/", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.pharmacyId, pharmacyId))
    .orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/", async (req, res) => {
  const parsed = insertCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const [category] = await db
    .insert(categoriesTable)
    .values({ ...parsed.data, pharmacyId })
    .returning();
  res.status(201).json(category);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.pharmacyId, pharmacyId)));
  res.json({ success: true, message: "Category deleted" });
});

export default router;
