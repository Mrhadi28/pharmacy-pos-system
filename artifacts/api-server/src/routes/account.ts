import { Router } from "express";
import { db } from "@workspace/db";
import {
  pharmaciesTable,
  categoriesTable,
  suppliersTable,
  customersTable,
  medicinesTable,
  salesTable,
  saleItemsTable,
  purchasesTable,
  purchaseItemsTable,
  manualCreditEntriesTable,
  manualCreditPaymentsTable,
  creditPaymentsTable,
  paymentSubmissionsTable,
  supportMessagesTable,
} from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { isPharmacySubscriptionActive, subscriptionAmountPkr } from "../lib/subscription";
import nodemailer from "nodemailer";

const router = Router();
const DEFAULT_NOTIFY_EMAIL = "contact.devarion@gmail.com";

function sessionUser(req: any): { pharmacyId?: number; userId?: number; fullName?: string } {
  return {
    pharmacyId: req.session?.pharmacyId,
    userId: req.session?.userId,
    fullName: req.session?.fullName,
  };
}

function parseDataUrlAttachment(dataUrl?: string | null): { filename: string; content: Buffer; contentType: string } | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const contentType = m[1] || "application/octet-stream";
  const base64 = m[2];
  const ext = contentType.split("/")[1] || "bin";
  return {
    filename: `payment-proof.${ext}`,
    content: Buffer.from(base64, "base64"),
    contentType,
  };
}

async function sendAdminEmail(params: {
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<boolean> {
  const smtpHost = process.env.SUPPORT_SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SUPPORT_SMTP_PORT || 587);
  const smtpUser = process.env.SUPPORT_SMTP_USER?.trim();
  const smtpPass = process.env.SUPPORT_SMTP_PASS?.replace(/\s+/g, "").trim();
  const toEmail = process.env.SUPPORT_TO_EMAIL || DEFAULT_NOTIFY_EMAIL;
  const fromEmail = process.env.SUPPORT_FROM_EMAIL || smtpUser;
  if (!smtpUser || !smtpPass || !toEmail || !fromEmail) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
    return true;
  } catch (e) {
    console.error("admin email failed", e);
    return false;
  }
}

router.get("/overview", async (req, res) => {
  const { pharmacyId } = sessionUser(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  const [latestSubmission] = await db
    .select()
    .from(paymentSubmissionsTable)
    .where(eq(paymentSubmissionsTable.pharmacyId, pharmacyId))
    .orderBy(paymentSubmissionsTable.createdAt)
    .limit(1);

  const paidUntil = pharmacy?.subscriptionPaidUntil ? new Date(pharmacy.subscriptionPaidUntil) : null;
  const now = Date.now();
  const untilMs = paidUntil ? paidUntil.getTime() : 0;
  const active = untilMs > now;
  const annualMs = 365 * 24 * 60 * 60 * 1000;
  const progressPercent = active
    ? Math.round(Math.min(1, Math.max(0, 1 - (untilMs - now) / annualMs)) * 100)
    : 0;

  res.json({
    plan: {
      name: "Annual",
      amountPkr: subscriptionAmountPkr(),
      period: "1 year",
      active: pharmacy ? isPharmacySubscriptionActive(pharmacy) : false,
      subscriptionPaidUntil: paidUntil?.toISOString() ?? null,
      progressPercent,
    },
    payment: {
      accountTitle: process.env.PAYMENT_ACCOUNT_TITLE || "Pharmacy Wise",
      accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "",
      bankName: process.env.PAYMENT_BANK_NAME || "",
      iban: process.env.PAYMENT_IBAN || "",
      note: process.env.PAYMENT_NOTE || null,
      whatsapp: process.env.PAYMENT_WHATSAPP || null,
      latestSubmission: latestSubmission ?? null,
    },
    support: {
      email: process.env.SUPPORT_TO_EMAIL || DEFAULT_NOTIFY_EMAIL,
      whatsapp: process.env.PAYMENT_WHATSAPP || null,
    },
  });
});

router.post("/payment-submission", async (req, res) => {
  const { pharmacyId, userId } = sessionUser(req);
  if (!pharmacyId || !userId) return res.status(401).json({ error: "Not authenticated" });
  const {
    accountTitle,
    accountNumber,
    bankName,
    amountPkr,
    transactionRef,
    payerName,
    payerPhone,
    screenshotDataUrl,
    note,
  } = req.body ?? {};

  if (!accountTitle || !accountNumber || !bankName || !amountPkr) {
    return res.status(400).json({ error: "accountTitle, accountNumber, bankName, amountPkr are required" });
  }

  const [row] = await db
    .insert(paymentSubmissionsTable)
    .values({
      pharmacyId,
      userId,
      accountTitle: String(accountTitle),
      accountNumber: String(accountNumber),
      bankName: String(bankName),
      amountPkr: Number(amountPkr),
      transactionRef: transactionRef ? String(transactionRef) : null,
      payerName: payerName ? String(payerName) : null,
      payerPhone: payerPhone ? String(payerPhone) : null,
      screenshotDataUrl: screenshotDataUrl ? String(screenshotDataUrl) : null,
      note: note ? String(note) : null,
    })
    .returning();

  const attachment = parseDataUrlAttachment(screenshotDataUrl ? String(screenshotDataUrl) : null);
  const mailSent = await sendAdminEmail({
    subject: `[Pharma-Wise Payment] ${String(bankName)} | ${String(accountTitle)} | ${Number(amountPkr)} PKR`,
    text:
      `PharmacyId: ${pharmacyId}\n` +
      `UserId: ${userId}\n` +
      `Bank: ${bankName}\n` +
      `AccountTitle: ${accountTitle}\n` +
      `AccountNo: ${accountNumber}\n` +
      `AmountPKR: ${amountPkr}\n` +
      `TransactionRef: ${transactionRef || "-"}\n` +
      `PayerName: ${payerName || "-"}\n` +
      `PayerPhone: ${payerPhone || "-"}\n` +
      `Note: ${note || "-"}\n` +
      `SubmittedAt: ${new Date().toISOString()}`,
    attachments: attachment ? [attachment] : undefined,
  });

  res.status(201).json({ success: true, submission: row, mailSent });
});

router.get("/backup", async (req, res) => {
  const { pharmacyId } = sessionUser(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.pharmacyId, pharmacyId));
  const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.pharmacyId, pharmacyId));
  const customers = await db.select().from(customersTable).where(eq(customersTable.pharmacyId, pharmacyId));
  const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
  const sales = await db.select().from(salesTable).where(eq(salesTable.pharmacyId, pharmacyId));
  const saleIds = sales.map((s) => s.id);
  const saleItems = saleIds.length
    ? await db.select().from(saleItemsTable).where(inArray(saleItemsTable.saleId, saleIds))
    : [];
  const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.pharmacyId, pharmacyId));
  const purchaseIds = purchases.map((p) => p.id);
  const purchaseItems = purchaseIds.length
    ? await db.select().from(purchaseItemsTable).where(inArray(purchaseItemsTable.purchaseId, purchaseIds))
    : [];
  const manualCreditEntries = await db
    .select()
    .from(manualCreditEntriesTable)
    .where(eq(manualCreditEntriesTable.pharmacyId, pharmacyId));
  const entryIds = manualCreditEntries.map((e) => e.id);
  const manualCreditPayments = entryIds.length
    ? await db.select().from(manualCreditPaymentsTable).where(inArray(manualCreditPaymentsTable.entryId, entryIds))
    : [];
  const creditPayments = saleIds.length
    ? await db.select().from(creditPaymentsTable).where(inArray(creditPaymentsTable.saleId, saleIds))
    : [];

  res.json({
    exportedAt: new Date().toISOString(),
    pharmacy,
    data: {
      categories,
      suppliers,
      customers,
      medicines,
      sales,
      saleItems,
      purchases,
      purchaseItems,
      manualCreditEntries,
      manualCreditPayments,
      creditPayments,
    },
  });
});

router.post("/restore", async (req, res) => {
  const { pharmacyId } = sessionUser(req);
  if (!pharmacyId) return res.status(401).json({ error: "Not authenticated" });

  const backup = req.body?.backup?.data;
  if (!backup) return res.status(400).json({ error: "backup.data is required" });

  await db.transaction(async (tx) => {
    const existingSales = await tx.select({ id: salesTable.id }).from(salesTable).where(eq(salesTable.pharmacyId, pharmacyId));
    const saleIds = existingSales.map((s) => s.id);
    if (saleIds.length) {
      await tx.delete(saleItemsTable).where(inArray(saleItemsTable.saleId, saleIds));
      await tx.delete(creditPaymentsTable).where(inArray(creditPaymentsTable.saleId, saleIds));
      await tx.delete(salesTable).where(inArray(salesTable.id, saleIds));
    }

    const existingPurchases = await tx
      .select({ id: purchasesTable.id })
      .from(purchasesTable)
      .where(eq(purchasesTable.pharmacyId, pharmacyId));
    const purchaseIds = existingPurchases.map((p) => p.id);
    if (purchaseIds.length) {
      await tx.delete(purchaseItemsTable).where(inArray(purchaseItemsTable.purchaseId, purchaseIds));
      await tx.delete(purchasesTable).where(inArray(purchasesTable.id, purchaseIds));
    }

    const existingManualEntries = await tx
      .select({ id: manualCreditEntriesTable.id })
      .from(manualCreditEntriesTable)
      .where(eq(manualCreditEntriesTable.pharmacyId, pharmacyId));
    const entryIds = existingManualEntries.map((e) => e.id);
    if (entryIds.length) {
      await tx.delete(manualCreditPaymentsTable).where(inArray(manualCreditPaymentsTable.entryId, entryIds));
      await tx.delete(manualCreditEntriesTable).where(inArray(manualCreditEntriesTable.id, entryIds));
    }

    await tx.delete(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
    await tx.delete(customersTable).where(eq(customersTable.pharmacyId, pharmacyId));
    await tx.delete(suppliersTable).where(eq(suppliersTable.pharmacyId, pharmacyId));
    await tx.delete(categoriesTable).where(eq(categoriesTable.pharmacyId, pharmacyId));

    const withPharmacy = <T extends { pharmacyId?: number | null }>(rows: T[]): T[] =>
      rows.map((r) => ({ ...r, pharmacyId })) as T[];

    if (backup.categories?.length) await tx.insert(categoriesTable).values(withPharmacy(backup.categories));
    if (backup.suppliers?.length) await tx.insert(suppliersTable).values(withPharmacy(backup.suppliers));
    if (backup.customers?.length) await tx.insert(customersTable).values(withPharmacy(backup.customers));
    if (backup.medicines?.length) await tx.insert(medicinesTable).values(withPharmacy(backup.medicines));
    if (backup.sales?.length) await tx.insert(salesTable).values(withPharmacy(backup.sales));
    if (backup.saleItems?.length) await tx.insert(saleItemsTable).values(backup.saleItems);
    if (backup.purchases?.length) await tx.insert(purchasesTable).values(withPharmacy(backup.purchases));
    if (backup.purchaseItems?.length) await tx.insert(purchaseItemsTable).values(backup.purchaseItems);
    if (backup.manualCreditEntries?.length) {
      await tx.insert(manualCreditEntriesTable).values(withPharmacy(backup.manualCreditEntries));
    }
    if (backup.manualCreditPayments?.length) await tx.insert(manualCreditPaymentsTable).values(backup.manualCreditPayments);
    if (backup.creditPayments?.length) await tx.insert(creditPaymentsTable).values(backup.creditPayments);
  });

  res.json({ success: true });
});

router.post("/support", async (req, res) => {
  const { pharmacyId, userId } = sessionUser(req);
  if (!pharmacyId || !userId) return res.status(401).json({ error: "Not authenticated" });

  const { subject, message, contactEmail, contactPhone } = req.body ?? {};
  if (!subject || !message) return res.status(400).json({ error: "subject and message are required" });

  const [saved] = await db
    .insert(supportMessagesTable)
    .values({
      pharmacyId,
      userId,
      subject: String(subject),
      message: String(message),
      contactEmail: contactEmail ? String(contactEmail) : null,
      contactPhone: contactPhone ? String(contactPhone) : null,
    })
    .returning();

  const mailSent = await sendAdminEmail({
    subject: `[Pharma-Wise Support] ${subject}`,
    text:
      `PharmacyId: ${pharmacyId}\n` +
      `UserId: ${userId}\n` +
      `ContactEmail: ${contactEmail || "-"}\n` +
      `ContactPhone: ${contactPhone || "-"}\n\n${message}`,
  });

  res.status(201).json({ success: true, ticket: saved, mailSent });
});

export default router;
