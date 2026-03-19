import { db } from "@workspace/db";
import {
  categoriesTable,
  suppliersTable,
  medicinesTable,
  customersTable,
} from "@workspace/db/schema";

async function seed() {
  console.log("Seeding database...");

  // Categories
  const categories = await db.insert(categoriesTable).values([
    { name: "Antibiotics", description: "Anti-bacterial medicines" },
    { name: "Analgesics", description: "Pain killers and pain relievers" },
    { name: "Antacids", description: "Stomach acid medicines" },
    { name: "Vitamins & Supplements", description: "Vitamins and nutritional supplements" },
    { name: "Antihistamines", description: "Allergy medicines" },
    { name: "Antidiabetics", description: "Diabetes management medicines" },
    { name: "Cardiovascular", description: "Heart and blood pressure medicines" },
    { name: "Cough & Cold", description: "Cough syrups and cold medicines" },
    { name: "Skin Care", description: "Topical creams and skin medicines" },
    { name: "Eye & Ear Drops", description: "Ophthalmic and ear preparations" },
  ]).onConflictDoNothing().returning();
  console.log(`Inserted ${categories.length} categories`);

  // Suppliers
  const suppliers = await db.insert(suppliersTable).values([
    { name: "Getz Pharma", contactPerson: "Ahmed Khan", phone: "0213-2345678", city: "Karachi", email: "orders@getzpharma.com" },
    { name: "Searle Pakistan", contactPerson: "Fatima Ali", phone: "0213-5678901", city: "Karachi", email: "sales@searle.com.pk" },
    { name: "Abbott Pakistan", contactPerson: "Dr. Omar Sheikh", phone: "0423-5670000", city: "Lahore", email: "info@abbott.com.pk" },
    { name: "Ferozsons Laboratories", contactPerson: "Bilal Hussain", phone: "0423-7654321", city: "Lahore" },
    { name: "PharmEvo", contactPerson: "Sara Malik", phone: "0213-4567890", city: "Karachi" },
  ]).onConflictDoNothing().returning();
  console.log(`Inserted ${suppliers.length} suppliers`);

  // Get inserted categories and suppliers
  const allCategories = await db.select().from(categoriesTable);
  const allSuppliers = await db.select().from(suppliersTable);

  const getCatId = (name: string) => allCategories.find(c => c.name === name)?.id;
  const getSuppId = (name: string) => allSuppliers.find(s => s.name === name)?.id;

  // Medicines
  const medicines = await db.insert(medicinesTable).values([
    {
      name: "Panadol Extra 500mg",
      genericName: "Paracetamol + Caffeine",
      categoryId: getCatId("Analgesics"),
      supplierId: getSuppId("Getz Pharma"),
      batchNumber: "PX-2024-001",
      purchasePrice: "25.00",
      salePrice: "35.00",
      stockQuantity: 500,
      minStockLevel: 50,
      unit: "tablets",
      expiryDate: "2026-12-31",
      manufacturer: "GSK Pakistan",
      requiresPrescription: false,
    },
    {
      name: "Brufen 400mg",
      genericName: "Ibuprofen",
      categoryId: getCatId("Analgesics"),
      supplierId: getSuppId("Abbott Pakistan"),
      batchNumber: "BR-2024-022",
      purchasePrice: "18.00",
      salePrice: "28.00",
      stockQuantity: 300,
      minStockLevel: 30,
      unit: "tablets",
      expiryDate: "2026-06-30",
      manufacturer: "Abbott Pakistan",
      requiresPrescription: false,
    },
    {
      name: "Augmentin 625mg",
      genericName: "Amoxicillin + Clavulanate",
      categoryId: getCatId("Antibiotics"),
      supplierId: getSuppId("Getz Pharma"),
      batchNumber: "AUG-2024-045",
      purchasePrice: "120.00",
      salePrice: "185.00",
      stockQuantity: 150,
      minStockLevel: 20,
      unit: "tablets",
      expiryDate: "2025-09-30",
      manufacturer: "GSK Pakistan",
      requiresPrescription: true,
    },
    {
      name: "Flagyl 400mg",
      genericName: "Metronidazole",
      categoryId: getCatId("Antibiotics"),
      supplierId: getSuppId("Searle Pakistan"),
      batchNumber: "FLG-2024-010",
      purchasePrice: "12.00",
      salePrice: "22.00",
      stockQuantity: 200,
      minStockLevel: 25,
      unit: "tablets",
      expiryDate: "2026-03-31",
      manufacturer: "Searle Pakistan",
      requiresPrescription: true,
    },
    {
      name: "Gaviscon Syrup",
      genericName: "Sodium Alginate",
      categoryId: getCatId("Antacids"),
      supplierId: getSuppId("Getz Pharma"),
      batchNumber: "GAV-2024-099",
      purchasePrice: "85.00",
      salePrice: "130.00",
      stockQuantity: 80,
      minStockLevel: 15,
      unit: "syrup",
      expiryDate: "2026-01-31",
      manufacturer: "RB Pakistan",
      requiresPrescription: false,
    },
    {
      name: "Vitamin C 500mg",
      genericName: "Ascorbic Acid",
      categoryId: getCatId("Vitamins & Supplements"),
      supplierId: getSuppId("PharmEvo"),
      batchNumber: "VTC-2024-055",
      purchasePrice: "15.00",
      salePrice: "25.00",
      stockQuantity: 400,
      minStockLevel: 50,
      unit: "tablets",
      expiryDate: "2027-12-31",
      manufacturer: "PharmEvo",
      requiresPrescription: false,
    },
    {
      name: "Claritine 10mg",
      genericName: "Loratadine",
      categoryId: getCatId("Antihistamines"),
      supplierId: getSuppId("Searle Pakistan"),
      batchNumber: "CLA-2024-033",
      purchasePrice: "30.00",
      salePrice: "50.00",
      stockQuantity: 8,
      minStockLevel: 20,
      unit: "tablets",
      expiryDate: "2025-08-31",
      manufacturer: "MSD Pakistan",
      requiresPrescription: false,
    },
    {
      name: "Glucophage 500mg",
      genericName: "Metformin HCl",
      categoryId: getCatId("Antidiabetics"),
      supplierId: getSuppId("Abbott Pakistan"),
      batchNumber: "GLU-2024-077",
      purchasePrice: "55.00",
      salePrice: "85.00",
      stockQuantity: 250,
      minStockLevel: 30,
      unit: "tablets",
      expiryDate: "2026-10-31",
      manufacturer: "Merck Pakistan",
      requiresPrescription: true,
    },
    {
      name: "Lopressor 50mg",
      genericName: "Metoprolol",
      categoryId: getCatId("Cardiovascular"),
      supplierId: getSuppId("Ferozsons Laboratories"),
      batchNumber: "LOP-2024-011",
      purchasePrice: "45.00",
      salePrice: "70.00",
      stockQuantity: 5,
      minStockLevel: 15,
      unit: "tablets",
      expiryDate: "2025-04-30",
      manufacturer: "Ferozsons",
      requiresPrescription: true,
    },
    {
      name: "Benylin Cough Syrup",
      genericName: "Diphenhydramine + Pseudoephedrine",
      categoryId: getCatId("Cough & Cold"),
      supplierId: getSuppId("Getz Pharma"),
      batchNumber: "BNY-2024-088",
      purchasePrice: "65.00",
      salePrice: "95.00",
      stockQuantity: 120,
      minStockLevel: 20,
      unit: "syrup",
      expiryDate: "2026-05-31",
      manufacturer: "Johnson & Johnson",
      requiresPrescription: false,
    },
    {
      name: "Betnovate Cream",
      genericName: "Betamethasone Valerate",
      categoryId: getCatId("Skin Care"),
      supplierId: getSuppId("Getz Pharma"),
      batchNumber: "BET-2024-066",
      purchasePrice: "40.00",
      salePrice: "65.00",
      stockQuantity: 90,
      minStockLevel: 15,
      unit: "cream",
      expiryDate: "2025-11-30",
      manufacturer: "GSK Pakistan",
      requiresPrescription: true,
    },
    {
      name: "Voltaren Gel",
      genericName: "Diclofenac Diethylamine",
      categoryId: getCatId("Analgesics"),
      supplierId: getSuppId("Ferozsons Laboratories"),
      batchNumber: "VOL-2024-044",
      purchasePrice: "110.00",
      salePrice: "165.00",
      stockQuantity: 60,
      minStockLevel: 10,
      unit: "cream",
      expiryDate: "2026-08-31",
      manufacturer: "Novartis Pakistan",
      requiresPrescription: false,
    },
  ]).onConflictDoNothing().returning();
  console.log(`Inserted ${medicines.length} medicines`);

  // Customers
  const customers = await db.insert(customersTable).values([
    { name: "Muhammad Arif", phone: "03001234567", city: "Lahore", cnic: "35201-1234567-1" },
    { name: "Zainab Hussain", phone: "03121234567", city: "Karachi" },
    { name: "Dr. Khalid Mehmood", phone: "03321234567", city: "Islamabad" },
    { name: "Ayesha Tariq", phone: "03451234567", city: "Faisalabad" },
    { name: "Aamir Sultan", phone: "03001122334", city: "Lahore" },
  ] as any[]).onConflictDoNothing().returning();
  console.log(`Inserted ${customers.length} customers`);

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
