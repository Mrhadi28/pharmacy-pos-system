import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** DB connectivity + whether core tables exist (run drizzle push if schemaOk is false). */
router.get("/health/db", async (_req, res) => {
  const devDetail = (e: unknown) =>
    process.env.NODE_ENV !== "production" && e instanceof Error ? e.message.slice(0, 400) : undefined;

  try {
    await db.execute(sql`select 1`);
  } catch (e) {
    res.status(503).json({
      ok: false,
      database: false,
      schemaOk: false,
      hint: "Cannot reach PostgreSQL. Check DATABASE_URL and that the server is running.",
      detail: devDetail(e),
    });
    return;
  }

  try {
    await db.execute(sql`select 1 from users limit 1`);
  } catch (e) {
    res.status(503).json({
      ok: false,
      database: true,
      schemaOk: false,
      hint: "Tables missing or out of date. From repo root: pnpm --filter @workspace/db run push",
      detail: devDetail(e),
    });
    return;
  }

  res.json({ ok: true, database: true, schemaOk: true });
});

export default router;
