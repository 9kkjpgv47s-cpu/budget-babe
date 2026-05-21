"use server";

import { randomUUID } from "crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";
import { buildReceiptExpenseMeta } from "@/app/(app)/receipts/receiptExpenseMeta";
import { postReceiptTotalCore } from "@/app/(app)/receipts/postReceiptTotalCore";
import { deleteReceiptStored, saveReceiptUpload } from "@/lib/uploads";

function revalidateMoneyFromReceipt(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/receipts");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/import");
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
  let message: string | undefined;
  if (total != null && total > 0) {
    const similar = await prisma.receipt.findFirst({
      where: {
        monthlyPeriodId: period.id,
        id: { not: rec.id },
        totalCents: total,
        uploadedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (similar) {
      message =
        "Uploaded. Note: another receipt with the same total was added in the last 7 days.";
    }
  }
  return { ok: true, receiptId: rec.id, message };
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
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const payeeRaw = String(formData.get("payee") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  if (!receiptId || !yearMonth.match(/^\d{4}-\d{2}$/)) {
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
  let parsed: ParsedReceiptLine[] = [];
  if (receipt.ocrParsedLines) {
    try {
      parsed = JSON.parse(receipt.ocrParsedLines) as ParsedReceiptLine[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }
  }
  const meta = buildReceiptExpenseMeta(receipt, parsed, description);
  if (payeeRaw) meta.payee = payeeRaw.slice(0, 200);
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }
  const tagsJson = await applyMerchantRulesToTags(meta.description, null);
  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      amountCents,
      description: meta.description,
      payee: meta.payee,
      spentAt: meta.spentAt,
      source: "ocr",
      receiptId,
      budgetPlanId,
      tagsJson,
    },
  });
  revalidateMoneyFromReceipt(yearMonth);
  return { ok: true };
}

/** One-tap post using OCR total, merchant description, inferred date, and budget hint. */
export async function quickPostReceiptTotalAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!receiptId || !yearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Missing receipt or month." };
  }
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return { error: "Receipt not found." };
  const result = await postReceiptTotalCore({
    receipt,
    userId: user.userId,
    yearMonth,
  });
  if (!result.ok) return { error: result.error };
  revalidateMoneyFromReceipt(yearMonth);
  return { ok: true, message: "Expense posted from receipt total." };
}

export async function batchPostReadyReceiptsAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Missing month." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const candidates = await prisma.receipt.findMany({
    where: {
      monthlyPeriodId: period.id,
      ocrStatus: "completed",
      totalCents: { gt: 0 },
      expenses: { none: {} },
    },
    orderBy: { uploadedAt: "asc" },
  });
  if (candidates.length === 0) {
    return { error: "No receipts are ready to post for this month." };
  }
  let posted = 0;
  const skipped: string[] = [];
  for (const receipt of candidates) {
    const result = await postReceiptTotalCore({
      receipt,
      userId: user.userId,
      yearMonth,
    });
    if (result.ok) posted++;
    else if (!result.skip) skipped.push(result.error);
  }
  revalidateMoneyFromReceipt(yearMonth);
  if (posted === 0) {
    return {
      error:
        skipped[0] ??
        "Could not post any receipts. Check totals and OCR status.",
    };
  }
  const suffix = skipped.length > 0 ? ` (${skipped.length} skipped)` : "";
  return {
    ok: true,
    message: `Posted ${posted} receipt${posted === 1 ? "" : "s"} to spending${suffix}.`,
  };
}

export async function createExpensesFromReceiptLinesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  if (!receiptId || !yearMonth.match(/^\d{4}-\d{2}$/)) {
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
  if (!receipt) return { error: "Receipt not found." };
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }
  const linesJsonRaw = String(formData.get("linesJson") ?? "").trim();
  let parsed: ParsedReceiptLine[];
  if (linesJsonRaw) {
    try {
      parsed = JSON.parse(linesJsonRaw) as ParsedReceiptLine[];
      if (!Array.isArray(parsed)) return { error: "Invalid edited lines." };
    } catch {
      return { error: "Could not read edited lines." };
    }
  } else if (receipt.ocrParsedLines?.trim()) {
    try {
      parsed = JSON.parse(receipt.ocrParsedLines) as ParsedReceiptLine[];
      if (!Array.isArray(parsed)) return { error: "Invalid parsed lines data." };
    } catch {
      return { error: "Could not read parsed lines." };
    }
  } else {
    return { error: "No parsed lines on this receipt." };
  }
  const { payee, spentAt } = buildReceiptExpenseMeta(receipt, parsed);
  const splitGroupId = randomUUID();
  let created = 0;
  for (const line of parsed) {
    const cents =
      typeof line.amountCents === "number" && line.amountCents > 0
        ? line.amountCents
        : null;
    if (cents == null) continue;
    const desc =
      String(line.description ?? "Receipt item").trim().slice(0, 500) ||
      "Receipt item";
    const tagsJson = await applyMerchantRulesToTags(desc, null);
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId: user.userId,
        amountCents: cents,
        description: desc,
        payee,
        spentAt,
        source: "ocr",
        receiptId,
        splitGroupId,
        budgetPlanId,
        tagsJson,
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
  return {
    ok: true,
    message: `Posted ${created} expense line(s) with one split group.`,
  };
}

export async function moveReceiptToMonthAction(formData: FormData): Promise<void> {
  await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const targetYm = String(formData.get("targetYearMonth") ?? "").trim();
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
  revalidatePath("/receipts");
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
    revalidatePath("/");
    revalidatePath("/receipts");
    revalidatePath("/expenses");
  }
}

export async function batchReprocessFailedReceiptsAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Missing month." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const failed = await prisma.receipt.findMany({
    where: {
      monthlyPeriodId: period.id,
      ocrStatus: { in: ["failed", "skipped"] },
    },
    select: { id: true },
  });
  if (failed.length === 0) {
    return { error: "No failed or skipped receipts this month." };
  }
  for (const { id } of failed) {
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
    after(() => {
      void import("@/lib/receiptOcr").then((m) => m.processReceiptOcrFile(id));
    });
  }
  revalidatePath("/");
  revalidatePath("/receipts");
  return {
    ok: true,
    message: `Re-queued OCR for ${failed.length} receipt${failed.length === 1 ? "" : "s"}.`,
  };
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
  after(() => {
    void import("@/lib/receiptOcr").then((m) => m.processReceiptOcrFile(id));
  });
  revalidatePath("/");
  revalidatePath("/receipts");
}
