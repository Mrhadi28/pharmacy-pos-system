import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, insertCustomerSchema } from "@workspace/db/schema";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const { search } = req.query;

  if (search) {
    const customers = await db
      .select()
      .from(customersTable)
      .where(
        or(
          ilike(customersTable.name, `%${search}%`),
          ilike(customersTable.phone, `%${search}%`),
          ilike(customersTable.cnic, `%${search}%`)
        )
      )
      .orderBy(customersTable.name);
    res.json(customers);
  } else {
    const customers = await db.select().from(customersTable).orderBy(customersTable.name);
    res.json(customers);
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(customer);
});

router.post("/", async (req, res) => {
  const parsed = insertCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = insertCustomerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db.update(customersTable).set(parsed.data).where(eq(customersTable.id, id)).returning();
  res.json(customer);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ success: true, message: "Customer deleted" });
});

export default router;
