import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { salesTable } from "./sales";

export const creditPaymentsTable = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => salesTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const manualCreditEntriesTable = pgTable("manual_credit_entries", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: text("due_date"),
  notes: text("notes"),
  status: text("status").notNull().default("unpaid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const manualCreditPaymentsTable = pgTable("manual_credit_payments", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => manualCreditEntriesTable.id),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreditPaymentSchema = createInsertSchema(creditPaymentsTable).omit({ id: true, createdAt: true });
export type InsertCreditPayment = z.infer<typeof insertCreditPaymentSchema>;
export type CreditPayment = typeof creditPaymentsTable.$inferSelect;

export const insertManualCreditEntrySchema = createInsertSchema(manualCreditEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertManualCreditEntry = z.infer<typeof insertManualCreditEntrySchema>;
export type ManualCreditEntry = typeof manualCreditEntriesTable.$inferSelect;

export const insertManualCreditPaymentSchema = createInsertSchema(manualCreditPaymentsTable).omit({ id: true, createdAt: true });
export type InsertManualCreditPayment = z.infer<typeof insertManualCreditPaymentSchema>;
export type ManualCreditPayment = typeof manualCreditPaymentsTable.$inferSelect;
