import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, pharmaciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isPharmacySubscriptionActive } from "../lib/subscription";
import { signWsToken } from "../realtime/ws-token";

const router = Router();

function skipSubscriptionCheckEnabled(): boolean {
  const v = process.env.SKIP_SUBSCRIPTION_CHECK?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const DB_PUSH_HINT =
  "Database tables may be missing. From repo root run: pnpm --filter @workspace/db run push (DATABASE_URL must be set).";

function hintForDbError(msg: string): string | undefined {
  if (/does not exist|Failed query|relation /i.test(msg)) return DB_PUSH_HINT;
  return undefined;
}

function jsonServerError(res: Response, status: number, e: unknown, fallbackMessage: string): void {
  const msg = e instanceof Error ? e.message : String(e);
  const dev = process.env.NODE_ENV !== "production";
  res.status(status).json({
    error: fallbackMessage,
    hint: hintForDbError(msg),
    ...(dev ? { detail: msg.slice(0, 500) } : {}),
  });
}

function normalizePhone(s: string): string {
  return s.replace(/\D/g, "");
}

function sendSessionJson(req: Request, res: Response, status: number, body: unknown): void {
  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Could not save session. Try again." });
      return;
    }
    res.status(status).json(body);
  });
}

router.post("/register", async (req, res) => {
  try {
    const { pharmacyName, ownerName, username, password, phone, city, address } = req.body;
    const u = String(username ?? "").trim();
    if (!pharmacyName?.trim() || !ownerName?.trim() || !u || !password || !String(phone ?? "").trim()) {
      res.status(400).json({ error: "Required fields missing" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, u));
    if (existing) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const { pharmacy, user } = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(pharmaciesTable)
        .values({
          name: String(pharmacyName).trim(),
          ownerName: String(ownerName).trim(),
          phone: String(phone).trim(),
          city: city ? String(city).trim() : null,
          address: address ? String(address).trim() : null,
        })
        .returning();

      const [usr] = await tx
        .insert(usersTable)
        .values({
          pharmacyId: p.id,
          username: u,
          passwordHash,
          fullName: String(ownerName).trim(),
          role: "owner",
          phone: String(phone).trim(),
        })
        .returning();

      return { pharmacy: p, user: usr };
    });

    const { passwordHash: _, ...safeUser } = user;

    (req.session as { userId?: number }).userId = user.id;
    (req.session as { pharmacyId?: number }).pharmacyId = pharmacy.id;
    (req.session as { role?: string }).role = user.role;

    sendSessionJson(req, res, 201, { user: safeUser, pharmacy });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "23505") {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
    console.error(e);
    jsonServerError(res, 500, e, "Registration could not be completed");
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { username, phone, newPassword } = req.body as {
      username?: string;
      phone?: string;
      newPassword?: string;
    };
    const u = String(username ?? "").trim();
    const ph = String(phone ?? "").trim();
    if (!u || !ph || !newPassword) {
      res.status(400).json({ error: "Username, phone, and new password are required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, u));
    if (!user || !user.isActive) {
      res.status(404).json({ error: "No account found with this username" });
      return;
    }
    if (!user.phone || normalizePhone(user.phone) !== normalizePhone(ph)) {
      res.status(400).json({ error: "Phone number does not match our records" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password updated. You can log in now." });
  } catch (e) {
    console.error(e);
    jsonServerError(res, 500, e, "Could not reset password");
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const u = String(username ?? "").trim();
    if (!u || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, u));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const [pharmacy] = await db
      .select()
      .from(pharmaciesTable)
      .where(eq(pharmaciesTable.id, user.pharmacyId));

    if (!pharmacy) {
      res.status(500).json({ error: "Pharmacy record missing for this user" });
      return;
    }

    const { passwordHash: _, ...safeUser } = user;

    (req.session as { userId?: number }).userId = user.id;
    (req.session as { pharmacyId?: number }).pharmacyId = user.pharmacyId;
    (req.session as { role?: string }).role = user.role;

    sendSessionJson(req, res, 200, { user: safeUser, pharmacy });
  } catch (e) {
    console.error(e);
    jsonServerError(res, 500, e, "Login could not be completed");
  }
});

/** Short-lived token for WebSocket /api/realtime (subscription must be active). */
router.get("/ws-token", async (req, res) => {
  try {
    const userId = (req.session as { userId?: number }).userId;
    const pharmacyId = (req.session as { pharmacyId?: number }).pharmacyId;
    if (!userId || !pharmacyId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const [p] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
    if (!skipSubscriptionCheckEnabled() && (!p || !isPharmacySubscriptionActive(p))) {
      res.status(402).json({ error: "Subscription required" });
      return;
    }
    const expiresInSec = 24 * 3600;
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const token = signWsToken({ userId, pharmacyId, exp });
    res.json({ token, expiresInSec });
  } catch (e) {
    jsonServerError(res, 500, e, "Could not issue realtime token");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.json({ success: true, message: "Logged out" });
  });
});

router.get("/me", async (req, res) => {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const [pharmacy] = await db
      .select()
      .from(pharmaciesTable)
      .where(eq(pharmaciesTable.id, user.pharmacyId));
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, pharmacy });
  } catch (e) {
    console.error(e);
    jsonServerError(res, 500, e, "Could not load session");
  }
});

export default router;
