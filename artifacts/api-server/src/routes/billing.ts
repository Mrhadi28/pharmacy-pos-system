import { Router } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isPharmacySubscriptionActive, subscriptionAmountPkr } from "../lib/subscription";

const router = Router();

/** Public: amount + payment hints for the paywall UI */
router.get("/info", (_req, res) => {
  res.json({
    amountPkr: subscriptionAmountPkr(),
    currency: "PKR",
    periodLabel: "1 year",
    whatsapp: process.env.PAYMENT_WHATSAPP || null,
    note: process.env.PAYMENT_NOTE || null,
  });
});

/**
 * After you receive 12,000 PKR (JazzCash/bank), call this once per pharmacy.
 * curl -X POST http://localhost:8080/api/billing/activate -H "Content-Type: application/json" -H "X-Billing-Secret: YOUR_SECRET" -d "{\"pharmacyId\":1}"
 */
router.post("/activate", async (req, res) => {
  const secret = req.get("x-billing-secret");
  const expected = process.env.BILLING_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Invalid or missing X-Billing-Secret" });
    return;
  }

  const pharmacyId = Number((req.body as { pharmacyId?: number }).pharmacyId);
  if (!Number.isInteger(pharmacyId) || pharmacyId < 1) {
    res.status(400).json({ error: "pharmacyId (positive integer) required" });
    return;
  }

  try {
    const [row] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
    if (!row) {
      res.status(404).json({ error: "Pharmacy not found" });
      return;
    }

    const now = Date.now();
    let base = now;
    if (row.subscriptionPaidUntil && new Date(row.subscriptionPaidUntil).getTime() > now) {
      base = new Date(row.subscriptionPaidUntil).getTime();
    }
    const until = new Date(base);
    until.setDate(until.getDate() + 365);

    await db
      .update(pharmaciesTable)
      .set({ subscriptionPaidUntil: until })
      .where(eq(pharmaciesTable.id, pharmacyId));

    res.json({
      success: true,
      pharmacyId,
      subscriptionPaidUntil: until.toISOString(),
      active: isPharmacySubscriptionActive({ subscriptionPaidUntil: until }),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not activate subscription" });
  }
});

export default router;
