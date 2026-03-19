import { Router } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/me", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  if (!pharmacy) { res.status(404).json({ error: "Pharmacy not found" }); return; }
  res.json(pharmacy);
});

router.put("/me", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { name, address, phone, ownerName, licenseNumber, email, city } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (address !== undefined) updateData.address = address;
  if (phone !== undefined) updateData.phone = phone;
  if (ownerName !== undefined) updateData.ownerName = ownerName;
  if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
  if (email !== undefined) updateData.email = email;
  if (city !== undefined) updateData.city = city;

  const [pharmacy] = await db.update(pharmaciesTable).set(updateData).where(eq(pharmaciesTable.id, pharmacyId)).returning();
  res.json(pharmacy);
});

export default router;
