import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").references(() => pharmaciesTable.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  cnic: text("cnic"),
  dateOfBirth: text("date_of_birth"),
  totalPurchases: numeric("total_purchases", { precision: 12, scale: 2 }).notNull().default("0"),
  visitCount: integer("visit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, totalPurchases: true, visitCount: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
