function skipSubscriptionCheckEnabled(): boolean {
  const v = import.meta.env.VITE_SKIP_SUBSCRIPTION_CHECK?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function hasActiveSubscription(pharmacy: {
  subscriptionPaidUntil?: string | null;
} | null): boolean {
  if (skipSubscriptionCheckEnabled()) return true;
  if (!pharmacy?.subscriptionPaidUntil) return false;
  return new Date(pharmacy.subscriptionPaidUntil).getTime() > Date.now();
}
