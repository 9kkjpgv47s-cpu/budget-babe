"use server";

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
  const dup = await prisma.expense.findUnique({ where: { receiptId } });
  if (dup) return { error: "This receipt already has a linked expense." };
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
