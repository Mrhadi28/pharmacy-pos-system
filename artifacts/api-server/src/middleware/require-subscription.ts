import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isPharmacySubscriptionActive, subscriptionAmountPkr } from "../lib/subscription";

function skipSubscriptionCheckEnabled(): boolean {
  const v = process.env.SKIP_SUBSCRIPTION_CHECK?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Blocks API usage (except auth/health/billing) when pharmacy has no valid yearly subscription.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  // Billing gate is intentionally disabled to keep full app access.
  // We keep this middleware in place so it can be re-enabled later.
  next();
  return;

  if (skipSubscriptionCheckEnabled()) {
    next();
    return;
  }

  // App mounts API at /api; baseUrl is /api and path is /auth/me → /api/auth/me
  const routePath = `${req.baseUrl ?? ""}${req.path ?? ""}` || req.path || "";
  if (
    routePath === "/api/healthz" ||
    routePath.startsWith("/api/health/") ||
    routePath.startsWith("/api/auth") ||
    routePath.startsWith("/api/billing") ||
    routePath.startsWith("/api/account")
  ) {
    next();
    return;
  }

  const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
  const userId = (req.session as { userId?: number }).userId;
  if (!userId || !pharmacyId) {
    next();
    return;
  }

  try {
    const [p] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
    if (!p || !isPharmacySubscriptionActive(p)) {
      const amount = subscriptionAmountPkr();
      res.status(402).json({
        error: "SUBSCRIPTION_REQUIRED",
        code: "SUBSCRIPTION_REQUIRED",
        amountPkr: amount,
        message: `Salana subscription: ${amount.toLocaleString("en-PK")} PKR (1 saal). Payment ke baad activate karwayen.`,
        paymentWhatsapp: process.env.PAYMENT_WHATSAPP || null,
        paymentNote: process.env.PAYMENT_NOTE || null,
      });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
