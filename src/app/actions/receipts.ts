"use server";

import { randomUUID } from "crypto";
import { after } from "next/server";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { currentYearMonth } from "@/lib/yearMonth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";
import {
  expenseDefaultsFromWrite,
  finalizeExpenseForWrite,
  getLastExpenseDefaultsForYearMonth,
  propagateExpenseToTargetPeriod,
  resolveReceiptPostingContext,
  suggestReceiptExpenseDescription,
  type ExpenseWriteFields,
} from "@/lib/entryDefaults";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";
import { deleteReceiptStored, saveReceiptUpload } from "@/lib/uploads";

function revalidateMoneyFromReceipt(yearMonth: string) {
  revalidateLedgerPaths(yearMonth, [
    "overview",
    "expenses",
    "bills",
    "budgets",
    "insights",
    "flow",
    "coach",
    "receipts",
    "tax",
  ]);
}

export async function uploadReceiptCore(
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const total = parseMoneyToCents(String(formData.get("total") ?? ""));
  const file = formData.get("file");
  if (!yearMonth || !(file instanceof File) || file.size === 0) {
    return { error: "Choose a file and month." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "File must be 8MB or smaller." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveReceiptUpload({
    buffer: bytes,
    basename: file.name,
  });
  const rec = await prisma.receipt.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      filename: storagePath,
      note,
      totalCents: total,
      ocrStatus: "pending",
    },
  });
  after(() => {
    void import("@/lib/receiptOcr").then((m) => m.processReceiptOcrFile(rec.id));
  });
  revalidateMoneyFromReceipt(yearMonth);
  return { ok: true };
}

export async function uploadReceiptAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return uploadReceiptCore(formData);
}

export async function createExpenseFromReceiptAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const pageYearMonth = String(formData.get("yearMonth") ?? "").trim();
  const postingHint = String(formData.get("postingYearMonth") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  let description = String(formData.get("description") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  const payee = String(formData.get("payee") ?? "").trim() || null;
  if (!receiptId || !pageYearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Missing receipt or month." };
  }
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return { error: "Receipt not found." };
  const dup = await prisma.expense.findFirst({ where: { receiptId } });
  if (dup) {
    return {
      error:
        "This receipt already has linked expenses. Remove them in Expenses before posting again.",
    };
  }
  let amountCents = parseMoneyToCents(amountRaw);
  if (amountCents == null && receipt.totalCents != null && receipt.totalCents > 0) {
    amountCents = receipt.totalCents;
  }
  if (amountCents == null || amountCents <= 0) {
    return {
      error: "Enter an amount in dollars, or wait for OCR to set a receipt total.",
    };
  }
  if (!description) {
    description = suggestReceiptExpenseDescription({
      filename: receipt.filename,
      note: receipt.note,
      ocrParsedLines: receipt.ocrParsedLines,
    });
  }
  const pageYmForResolve =
    postingHint.match(/^\d{4}-\d{2}$/) ? postingHint : pageYearMonth;
  const { yearMonth } = await resolveReceiptPostingContext(
    receiptId,
    pageYmForResolve,
  );
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const lastDefaults = await getLastExpenseDefaultsForYearMonth(yearMonth);
  let categoryId: string | null = categoryIdRaw || lastDefaults.categoryId;
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) categoryId = null;
  }
  const fields = await finalizeExpenseForWrite(
    {
      description,
      tagsJson: lastDefaults.tagsJson,
      budgetPlanId: budgetPlanIdRaw || lastDefaults.budgetPlanId,
      payee: payee ?? lastDefaults.payee,
      categoryId,
      autoSuggestCategory: !categoryId,
    },
    yearMonth,
  );
  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      amountCents,
      description,
      spentAt: new Date(),
      source: "ocr",
      receiptId,
      budgetPlanId: fields.budgetPlanId,
      tagsJson: fields.tagsJson,
      payee: fields.payee,
      categoryId: fields.categoryId,
      taxCategory: fields.taxCategory,
    },
  });
  revalidateMoneyFromReceipt(yearMonth);
  if (pageYearMonth !== yearMonth) revalidateMoneyFromReceipt(pageYearMonth);
  const msg =
    yearMonth !== pageYearMonth
      ? `Expense added to ${yearMonth} (receipt month).`
      : "Expense added — view on Overview or Expenses.";
  return { ok: true, message: msg, entryDefaults: expenseDefaultsFromWrite(fields) };
}

export async function createExpensesFromReceiptLinesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const pageYearMonth = String(formData.get("yearMonth") ?? "").trim();
  const postingHint = String(formData.get("postingYearMonth") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!receiptId || !pageYearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Missing receipt or month." };
  }
  const dup = await prisma.expense.findFirst({ where: { receiptId } });
  if (dup) {
    return {
      error:
        "This receipt already has linked expenses. Remove them in Expenses before posting parsed lines.",
    };
  }
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt?.ocrParsedLines?.trim()) {
    return { error: "No parsed lines on this receipt." };
  }
  let parsed: ParsedReceiptLine[];
  try {
    parsed = JSON.parse(receipt.ocrParsedLines) as ParsedReceiptLine[];
    if (!Array.isArray(parsed)) return { error: "Invalid parsed lines data." };
  } catch {
    return { error: "Could not read parsed lines." };
  }
  const pageYmForResolve =
    postingHint.match(/^\d{4}-\d{2}$/) ? postingHint : pageYearMonth;
  const { yearMonth } = await resolveReceiptPostingContext(
    receiptId,
    pageYmForResolve,
  );
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const lastDefaults = await getLastExpenseDefaultsForYearMonth(yearMonth);
  let sharedBudgetId: string | null = budgetPlanIdRaw || lastDefaults.budgetPlanId;
  let sharedCategoryId: string | null = categoryIdRaw || lastDefaults.categoryId;
  if (sharedCategoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: sharedCategoryId },
    });
    if (!cat) sharedCategoryId = null;
  }
  const splitGroupId = randomUUID();
  let created = 0;
  let lastFields: ExpenseWriteFields | null = null;
  for (const line of parsed) {
    const cents =
      typeof line.amountCents === "number" && line.amountCents > 0
        ? line.amountCents
        : null;
    if (cents == null) continue;
    const desc =
      String(line.description ?? "Receipt item").trim().slice(0, 500) ||
      "Receipt item";
    const fields = await finalizeExpenseForWrite(
      {
        description: desc,
        tagsJson: lastDefaults.tagsJson,
        budgetPlanId: sharedBudgetId,
        payee: lastDefaults.payee,
        categoryId: sharedCategoryId,
        autoSuggestCategory: !sharedCategoryId,
      },
      yearMonth,
    );
    lastFields = fields;
    sharedBudgetId = fields.budgetPlanId;
    sharedCategoryId = fields.categoryId;
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId: user.userId,
        amountCents: cents,
        description: desc,
        spentAt: new Date(),
        source: "ocr",
        receiptId,
        splitGroupId,
        budgetPlanId: fields.budgetPlanId,
        tagsJson: fields.tagsJson,
        payee: fields.payee,
        categoryId: fields.categoryId,
        taxCategory: fields.taxCategory,
      },
    });
    created++;
  }
  if (created === 0) {
    return {
      error:
        "No lines with positive amounts. Use the total form, fix OCR, or re-run OCR.",
    };
  }
  revalidateMoneyFromReceipt(yearMonth);
  if (pageYearMonth !== yearMonth) revalidateMoneyFromReceipt(pageYearMonth);
  const monthNote =
    yearMonth !== pageYearMonth ? ` to ${yearMonth}` : "";
  return {
    ok: true,
    message: `Posted ${created} expense line(s)${monthNote} with one split group.`,
    entryDefaults: lastFields ? expenseDefaultsFromWrite(lastFields) : undefined,
  };
}

export async function moveReceiptToMonthAction(formData: FormData): Promise<void> {
  await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const targetYm = String(formData.get("targetYearMonth") ?? "").trim();
  const moveLinkedRaw = formData.get("moveLinkedExpenses");
  const moveLinkedExpenses =
    moveLinkedRaw === null || moveLinkedRaw === "on" || moveLinkedRaw === "true";
  if (!receiptId || !targetYm.match(/^\d{4}-\d{2}$/)) return;
  const rec = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!rec) return;
  const oldYm = rec.monthlyPeriod?.yearMonth ?? null;
  const period = await getOrCreateMonthlyPeriod(targetYm);
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { monthlyPeriodId: period.id },
  });
  if (moveLinkedExpenses) {
    const sourcePeriodId = rec.monthlyPeriodId ?? period.id;
    const linked = await prisma.expense.findMany({
      where: { receiptId },
      select: {
        id: true,
        description: true,
        tagsJson: true,
        budgetPlanId: true,
        payee: true,
        categoryId: true,
        taxCategory: true,
      },
    });
    for (const exp of linked) {
      const fields = await propagateExpenseToTargetPeriod(
        exp,
        sourcePeriodId,
        period.id,
        targetYm,
      );
      await prisma.expense.update({
        where: { id: exp.id },
        data: {
          monthlyPeriodId: period.id,
          budgetPlanId: fields.budgetPlanId,
          categoryId: fields.categoryId,
          taxCategory: fields.taxCategory,
          tagsJson: fields.tagsJson,
          payee: fields.payee,
        },
      });
    }
    revalidatePath("/tax");
  }
  revalidateMoneyFromReceipt(targetYm);
  if (oldYm && oldYm !== targetYm) {
    revalidateMoneyFromReceipt(oldYm);
  }
}

export async function deleteReceiptAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await prisma.receipt.findUnique({
    where: { id },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!existing) return;
  const storagePath = existing.filename;
  await prisma.receipt.delete({ where: { id } });
  await deleteReceiptStored(storagePath);
  const ym = existing.monthlyPeriod?.yearMonth;
  if (ym) revalidateMoneyFromReceipt(ym);
  else {
    const fallback = currentYearMonth();
    revalidateLedgerPaths(fallback, ["overview", "receipts", "expenses"]);
  }
}

export async function reprocessReceiptOcrAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.receipt.update({
    where: { id },
    data: {
      ocrStatus: "pending",
      ocrError: null,
      ocrRawText: null,
      ocrParsedLines: null,
      ocrConfidence: null,
    },
  });
  const rec = await prisma.receipt.findUnique({
    where: { id },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  const ym = rec?.monthlyPeriod?.yearMonth ?? currentYearMonth();
  after(() => {
    void import("@/lib/receiptOcr").then((m) => m.processReceiptOcrFile(id));
  });
  revalidateLedgerPaths(ym, ["overview", "receipts"]);
}
