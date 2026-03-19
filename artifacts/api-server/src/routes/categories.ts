import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, insertCategorySchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/", async (req, res) => {
  const parsed = insertCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(category);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ success: true, message: "Category deleted" });
});

export default router;
