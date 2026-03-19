import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, insertSupplierSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const suppliers = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(suppliers);
});

router.post("/", async (req, res) => {
  const parsed = insertSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.insert(suppliersTable).values(parsed.data).returning();
  res.status(201).json(supplier);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = insertSupplierSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, id)).returning();
  res.json(supplier);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
  res.json({ success: true, message: "Supplier deleted" });
});

export default router;
