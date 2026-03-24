import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { pharmaciesTable } from "./pharmacies";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").references(() => pharmaciesTable.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull(),
  changeAmount: numeric("change_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("paid"), // paid, credit, partial
  paymentMethod: text("payment_method").notNull().default("cash"),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  medicineId: integer("medicine_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  medicineUnit: text("medicine_unit").notNull().default("tablets"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleRecord = typeof salesTable.$inferSelect;
export type SaleItem = typeof saleItemsTable.$inferSelect;
