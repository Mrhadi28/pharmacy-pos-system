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

export const insertCreditPaymentSchema = createInsertSchema(creditPaymentsTable).omit({ id: true, createdAt: true });
export type InsertCreditPayment = z.infer<typeof insertCreditPaymentSchema>;
export type CreditPayment = typeof creditPaymentsTable.$inferSelect;
