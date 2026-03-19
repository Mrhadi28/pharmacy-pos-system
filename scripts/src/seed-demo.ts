import { db } from "@workspace/db";
import { pharmaciesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedDemo() {
  console.log("Creating demo pharmacy and admin user...");

  // Create demo pharmacy
  const existing = await db.select().from(pharmaciesTable).limit(1);
  let pharmacy = existing[0];

  if (!pharmacy) {
    const [p] = await db.insert(pharmaciesTable).values({
      name: "Al-Shifa Medical Store",
      ownerName: "Dr. Ahmed Khan",
      phone: "0321-1234567",
      city: "Karachi",
      address: "Shop 5, Main Market, Block 2, Gulshan",
      licenseNumber: "KHI-2024-001",
      email: "info@alshifa.com.pk",
    }).returning();
    pharmacy = p;
    console.log("Created pharmacy:", pharmacy.name);
  } else {
    console.log("Using existing pharmacy:", pharmacy.name);
  }

  // Check if admin user exists
  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const [user] = await db.insert(usersTable).values({
      pharmacyId: pharmacy.id,
      username: "admin",
      passwordHash,
      fullName: "Dr. Ahmed Khan",
      role: "owner",
      phone: "0321-1234567",
    }).returning();
    console.log("Created admin user: admin / admin123");
  } else {
    console.log("Admin user already exists");
  }

  // Also create a cashier for demo
  const [existingCashier] = await db.select().from(usersTable).where(eq(usersTable.username, "cashier1"));
  if (!existingCashier) {
    const passwordHash = await bcrypt.hash("cashier123", 10);
    await db.insert(usersTable).values({
      pharmacyId: pharmacy.id,
      username: "cashier1",
      passwordHash,
      fullName: "Muhammad Bilal",
      role: "cashier",
      phone: "0300-7654321",
    });
    console.log("Created cashier user: cashier1 / cashier123");
  }

  console.log("\n✅ Demo seeding complete!");
  console.log("Login credentials:");
  console.log("  Admin:   username=admin      password=admin123");
  console.log("  Cashier: username=cashier1   password=cashier123");
  process.exit(0);
}

seedDemo().catch(e => { console.error(e); process.exit(1); });
