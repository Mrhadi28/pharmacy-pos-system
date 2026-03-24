import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { suppliersTable } from "./suppliers";
import { pharmaciesTable } from "./pharmacies";

export const medicinesTable = pgTable("medicines", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").references(() => pharmaciesTable.id),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  batchNumber: text("batch_number"),
  barcode: text("barcode"),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  unit: text("unit").notNull().default("tablets"),
  expiryDate: text("expiry_date"),
  manufacturingDate: text("manufacturing_date"),
  manufacturer: text("manufacturer"),
  description: text("description"),
  requiresPrescription: boolean("requires_prescription").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({ id: true, createdAt: true });
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type Medicine = typeof medicinesTable.$inferSelect;
