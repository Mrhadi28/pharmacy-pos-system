import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pharmaciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.post("/register", async (req, res) => {
  const { pharmacyName, ownerName, username, password, phone, city, address } = req.body;
  if (!pharmacyName || !ownerName || !username || !password || !phone) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }

  // Check username unique
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  // Create pharmacy
  const [pharmacy] = await db.insert(pharmaciesTable).values({
    name: pharmacyName,
    ownerName,
    phone,
    city: city ?? null,
    address: address ?? null,
  }).returning();

  // Create owner user
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    pharmacyId: pharmacy.id,
    username,
    passwordHash,
    fullName: ownerName,
    role: "owner",
    phone,
  }).returning();

  const { passwordHash: _, ...safeUser } = user;

  (req.session as any).userId = user.id;
  (req.session as any).pharmacyId = pharmacy.id;
  (req.session as any).role = user.role;

  res.status(201).json({ user: safeUser, pharmacy });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, user.pharmacyId));

  const { passwordHash: _, ...safeUser } = user;

  (req.session as any).userId = user.id;
  (req.session as any).pharmacyId = user.pharmacyId;
  (req.session as any).role = user.role;

  res.json({ user: safeUser, pharmacy });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out" });
  });
});

router.get("/me", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, user.pharmacyId));
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, pharmacy });
});

export default router;
