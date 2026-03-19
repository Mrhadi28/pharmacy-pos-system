import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const users = await db.select({
    id: usersTable.id,
    pharmacyId: usersTable.pharmacyId,
    username: usersTable.username,
    fullName: usersTable.fullName,
    role: usersTable.role,
    phone: usersTable.phone,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.pharmacyId, pharmacyId));

  res.json(users);
});

router.post("/", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  const role = (req.session as any).role;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (role !== "owner" && role !== "admin") { res.status(403).json({ error: "Only owner/admin can create users" }); return; }

  const { username, password, fullName, role: newRole, phone } = req.body;
  if (!username || !password || !fullName || !newRole) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing) { res.status(400).json({ error: "Username already taken" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    pharmacyId,
    username,
    passwordHash,
    fullName,
    role: newRole,
    phone: phone ?? null,
  }).returning();

  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.put("/:id", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  const sessionRole = (req.session as any).role;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (sessionRole !== "owner" && sessionRole !== "admin") { res.status(403).json({ error: "Permission denied" }); return; }

  const id = parseInt(req.params.id);
  const { fullName, role, phone, isActive, password } = req.body;

  const updateData: Record<string, unknown> = {};
  if (fullName !== undefined) updateData.fullName = fullName;
  if (role !== undefined) updateData.role = role;
  if (phone !== undefined) updateData.phone = phone;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.update(usersTable).set(updateData).where(
    and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId))
  ).returning();

  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

router.delete("/:id", async (req, res) => {
  const pharmacyId = (req.session as any).pharmacyId;
  const sessionRole = (req.session as any).role;
  const sessionUserId = (req.session as any).userId;
  if (!pharmacyId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (sessionRole !== "owner" && sessionRole !== "admin") { res.status(403).json({ error: "Permission denied" }); return; }

  const id = parseInt(req.params.id);
  if (id === sessionUserId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }

  await db.delete(usersTable).where(
    and(eq(usersTable.id, id), eq(usersTable.pharmacyId, pharmacyId))
  );
  res.json({ success: true, message: "User deleted" });
});

export default router;
