import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { hasActiveSubscription } from "@/lib/pharmacy-subscription";
import { getSupabaseClient } from "@/lib/supabase";

/** Tables mirrored in `lib/db` that should trigger UI refresh when changed (Supabase → browser). */
const REALTIME_TABLES = [
  "medicines",
  "sales",
  "sale_items",
  "purchases",
  "purchase_items",
  "customers",
  "suppliers",
  "categories",
  "pharmacies",
  "users",
  "credit_payments",
  "manual_credit_entries",
  "manual_credit_payments",
] as const;

/**
 * Supabase Realtime `postgres_changes` → React Query invalidate.
 * Requires: same Postgres as `DATABASE_URL`, tables in publication `supabase_realtime`
 * (run repo `scripts/supabase-realtime-publication.sql` in SQL Editor), and RLS/policies that allow events if RLS is on.
 */
export function SupabaseRealtimeSync() {
  const { user, pharmacy } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user || !hasActiveSubscription(pharmacy)) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const invalidateAllApi = (): void => {
      qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return typeof k === "string" && k.startsWith("/api/");
        },
      });
    };

    const channelName = "pharma-wise-data";
    let ch = supabase.channel(channelName);
    for (const table of REALTIME_TABLES) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          invalidateAllApi();
        },
      );
    }

    ch.subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, pharmacy, qc]);

  return null;
}
