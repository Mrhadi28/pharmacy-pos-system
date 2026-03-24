-- Run once in Supabase → SQL Editor (same project as DATABASE_URL).
-- Enables browser Realtime sync (see artifacts/pharma-pos/src/hooks/use-supabase-realtime-sync.tsx).
-- If a table is already in the publication, that line errors — comment it out and re-run.

alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.medicines;
alter publication supabase_realtime add table public.suppliers;
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.sale_items;
alter publication supabase_realtime add table public.purchases;
alter publication supabase_realtime add table public.purchase_items;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.pharmacies;
alter publication supabase_realtime add table public.credit_payments;
alter publication supabase_realtime add table public.manual_credit_entries;
alter publication supabase_realtime add table public.manual_credit_payments;

-- If the client subscribes but never receives events: Dashboard → Realtime → ensure enabled,
-- and check RLS: anon needs a SELECT policy on these tables, or RLS off on public tables you replicate.
