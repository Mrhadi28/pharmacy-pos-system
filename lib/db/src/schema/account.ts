import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies";
import { usersTable } from "./users";

export const paymentSubmissionsTable = pgTable("payment_submissions", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  accountTitle: text("account_title").notNull(),
  accountNumber: text("account_number").notNull(),
  bankName: text("bank_name").notNull(),
  amountPkr: integer("amount_pkr").notNull(),
  transactionRef: text("transaction_ref"),
  payerName: text("payer_name"),
  payerPhone: text("payer_phone"),
  screenshotDataUrl: text("screenshot_data_url"),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentSubmissionSchema = createInsertSchema(paymentSubmissionsTable).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessagesTable).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertPaymentSubmission = z.infer<typeof insertPaymentSubmissionSchema>;
export type PaymentSubmission = typeof paymentSubmissionsTable.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
