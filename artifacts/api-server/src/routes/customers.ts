import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, insertCustomerSchema } from "@workspace/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";

const router = Router();
const sessionPharmacyId = (req: any): number | undefined => req.session?.pharmacyId;

router.get("/", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const { search } = req.query;

  if (search) {
    const customers = await db
      .select()
      .from(customersTable)
      .where(
        and(
          eq(customersTable.pharmacyId, pharmacyId),
          or(
            ilike(customersTable.name, `%${search}%`),
            ilike(customersTable.phone, `%${search}%`),
            ilike(customersTable.cnic, `%${search}%`)
          ),
        )
      )
      .orderBy(customersTable.name);
    res.json(customers);
  } else {
    const customers = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.pharmacyId, pharmacyId))
      .orderBy(customersTable.name);
    res.json(customers);
  }
});

router.get("/:id", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const id = parseInt(req.params.id);
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, id), eq(customersTable.pharmacyId, pharmacyId)));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(customer);
});

router.post("/", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = insertCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db
    .insert(customersTable)
    .values({ ...parsed.data, pharmacyId })
    .returning();
  res.status(201).json(customer);
});

router.put("/:id", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const id = parseInt(req.params.id);
  const parsed = insertCustomerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(and(eq(customersTable.id, id), eq(customersTable.pharmacyId, pharmacyId)))
    .returning();
  res.json(customer);
});

router.delete("/:id", async (req, res) => {
  const pharmacyId = sessionPharmacyId(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });
  const id = parseInt(req.params.id);
  await db
    .delete(customersTable)
    .where(and(eq(customersTable.id, id), eq(customersTable.pharmacyId, pharmacyId)));
  res.json({ success: true, message: "Customer deleted" });
});

export default router;
