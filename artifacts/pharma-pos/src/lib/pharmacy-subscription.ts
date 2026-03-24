function skipSubscriptionCheckEnabled(): boolean {
  const v = import.meta.env.VITE_SKIP_SUBSCRIPTION_CHECK?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const TRIAL_DAYS = 14;
const trialKey = (pharmacyId?: number): string => `pharmacy-trial-until:${pharmacyId ?? 0}`;

function hasActiveLocalTrial(pharmacyId?: number): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(trialKey(pharmacyId));
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  return until > Date.now();
}

export function enableLocalTrial(pharmacyId?: number): void {
  if (typeof window === "undefined") return;
  const until = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  window.localStorage.setItem(trialKey(pharmacyId), String(until));
}

export function hasActiveSubscription(pharmacy: {
  id?: number;
  subscriptionPaidUntil?: string | null;
} | null): boolean {
  if (skipSubscriptionCheckEnabled()) return true;
  if (hasActiveLocalTrial(pharmacy?.id)) return true;
  if (!pharmacy?.subscriptionPaidUntil) return false;
  return new Date(pharmacy.subscriptionPaidUntil).getTime() > Date.now();
}
