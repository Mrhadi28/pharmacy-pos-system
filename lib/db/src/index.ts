import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

function isSupabasePostgresUrl(url: string): boolean {
  try {
    const normalized = url.replace(/^postgresql:/i, "http:");
    const { hostname } = new URL(normalized);
    return hostname.endsWith(".supabase.com") || hostname.endsWith(".supabase.co");
  } catch {
    return /supabase\.(com|co)/i.test(url);
  }
}

/** Session / direct pooler works with Drizzle + long-lived Node; avoid Transaction pooler (6543) for migrations. */
export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? "15"),
  ...(isSupabasePostgresUrl(connectionString)
    ? {
        connectionTimeoutMillis: Number(
          process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "15000",
        ),
      }
    : {}),
});

export const db = drizzle(pool, { schema });

export * from "./schema";
