import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmaciesTable = pgTable("pharmacies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  ownerName: text("owner_name"),
  licenseNumber: text("license_number"),
  email: text("email"),
  city: text("city"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPharmacySchema = createInsertSchema(pharmaciesTable).omit({ id: true, createdAt: true });
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;
export type Pharmacy = typeof pharmaciesTable.$inferSelect;
