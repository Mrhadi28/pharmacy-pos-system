import type { Pharmacy } from "@workspace/db/schema";

export function subscriptionAmountPkr(): number {
  const n = Number(process.env.SUBSCRIPTION_AMOUNT_PKR ?? "12000");
  return Number.isFinite(n) && n > 0 ? n : 12000;
}

export function isPharmacySubscriptionActive(p: Pick<Pharmacy, "subscriptionPaidUntil">): boolean {
  if (!p.subscriptionPaidUntil) return false;
  return new Date(p.subscriptionPaidUntil).getTime() > Date.now();
}
