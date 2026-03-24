export function enableLocalTrial(_pharmacyId?: number): void {
  // Billing flow is disabled for now. Kept as no-op for compatibility.
}

export function hasActiveSubscription(_pharmacy: {
  id?: number;
  subscriptionPaidUntil?: string | null;
} | null): boolean {
  // Payment gate is disabled for now: always allow software usage.
  return true;
}
