"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";

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
  const ext = path.extname(file.name) || ".bin";
  const safeBase = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 40);
  const filename = `${Date.now()}-${safeBase || "receipt"}${ext}`;
  const uploadDir = path.join(process.cwd(), "data", "receipts");
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);
  const rec = await prisma.receipt.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      filename,
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
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  let description = String(formData.get("description") ?? "").trim();
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
  if (!description) description = `Receipt: ${receipt.filename}`;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }
  const tagsJson = await applyMerchantRulesToTags(description, null);
  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      amountCents,
      description,
      spentAt: new Date(),
      source: "ocr",
      receiptId,
      budgetPlanId,
      tagsJson,
    },
  });
  revalidateMoneyFromReceipt(yearMonth);
  return { ok: true };
}

export async function createExpensesFromReceiptLinesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const receiptId = String(formData.get("receiptId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
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
  const period = await getOrCreateMonthlyPeriod(yearMonth);
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
        spentAt: new Date(),
        source: "ocr",
        receiptId,
        splitGroupId,
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
  return { ok: true, message: `Posted ${created} expense line(s) with one split group.` };
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
  await prisma.receipt.delete({ where: { id } });
  const ym = existing?.monthlyPeriod?.yearMonth;
  if (ym) revalidateMoneyFromReceipt(ym);
  else {
    revalidatePath("/");
    revalidatePath("/receipts");
    revalidatePath("/expenses");
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
  after(() => {
    void import("@/lib/receiptOcr").then((m) => m.processReceiptOcrFile(id));
  });
  revalidatePath("/");
  revalidatePath("/receipts");
}
