"use server";

import { revalidatePath } from "next/cache";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";
import {
  commaListToTagsJson,
  finalizeExpenseForWrite,
} from "@/lib/entryDefaults";
import { coerceCategoryId } from "@/lib/categories";
import { reapplyExpenseClassificationForPeriod } from "@/lib/expenseWrite";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

function revalidateAll(yearMonth: string) {
  revalidateLedgerPaths(yearMonth);
}

function parseExpenseIds(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function bulkApplyTagsToExpensesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const ids = parseExpenseIds(String(formData.get("expenseIds") ?? ""));
  const tagsRaw = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const tagMode = String(formData.get("tagMode") ?? "append");
  if (!yearMonth || ids.length === 0 || tagsRaw.length === 0) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    const manual =
      tagMode === "replace"
        ? mergeTagLists(tagsRaw)
        : mergeTagLists(parseTagsJson(exp.tagsJson), tagsRaw);
    const fields = await finalizeExpenseForWrite(
      {
        description: exp.description,
        tagsJson: manual ?? exp.tagsJson,
        budgetPlanId: exp.budgetPlanId,
        payee: exp.payee,
        categoryId: exp.categoryId,
        taxCategory: exp.taxCategory,
        autoSuggestCategory: false,
      },
      yearMonth,
    );
    await prisma.expense.update({
      where: { id },
      data: {
        tagsJson: fields.tagsJson,
        categoryId: fields.categoryId,
        budgetPlanId: fields.budgetPlanId,
        taxCategory: fields.taxCategory,
        payee: fields.payee,
      },
    });
  }
  revalidateAll(yearMonth);
}

export async function bulkSetBudgetForExpensesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const ids = parseExpenseIds(String(formData.get("expenseIds") ?? ""));
  const raw = String(formData.get("bulkBudgetPlanId") ?? "").trim();
  if (!yearMonth || ids.length === 0 || !raw) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  let budgetPlanId: string | null = null;
  if (raw === "none") {
    budgetPlanId = null;
  } else {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: raw, monthlyPeriodId: period.id },
    });
    if (!plan) return;
    budgetPlanId = plan.id;
  }
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    const fields = await finalizeExpenseForWrite(
      {
        description: exp.description,
        tagsJson: exp.tagsJson,
        budgetPlanId,
        payee: exp.payee,
        categoryId: exp.categoryId,
        taxCategory: exp.taxCategory,
        autoSuggestCategory: false,
      },
      yearMonth,
    );
    await prisma.expense.update({
      where: { id },
      data: {
        budgetPlanId: fields.budgetPlanId,
        tagsJson: fields.tagsJson,
        payee: fields.payee,
        categoryId: fields.categoryId,
        taxCategory: fields.taxCategory,
      },
    });
  }
  revalidateAll(yearMonth);
}

export async function bulkSetCategoryForExpensesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const ids = parseExpenseIds(String(formData.get("expenseIds") ?? ""));
  const raw = String(formData.get("bulkCategoryId") ?? "").trim();
  if (!yearMonth || ids.length === 0) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const categoryId = await coerceCategoryId(raw && raw !== "none" ? raw : null);
  if (raw && raw !== "none" && !categoryId) return;
  const applyTax = String(formData.get("applyTaxFromCategory") ?? "on") === "on";
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    const fields = await finalizeExpenseForWrite(
      {
        description: exp.description,
        tagsJson: exp.tagsJson,
        budgetPlanId: exp.budgetPlanId,
        payee: exp.payee,
        categoryId,
        taxCategory: exp.taxCategory,
        autoSuggestCategory: false,
        forceCategoryTaxDefault: applyTax,
      },
      yearMonth,
    );
    await prisma.expense.update({
      where: { id },
      data: {
        categoryId: fields.categoryId,
        budgetPlanId: fields.budgetPlanId,
        taxCategory: fields.taxCategory,
        tagsJson: fields.tagsJson,
        payee: fields.payee,
      },
    });
  }
  revalidateAll(yearMonth);
  revalidatePath("/tax");
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const spentRaw = String(formData.get("spentAt") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const payee = String(formData.get("payee") ?? "").trim() || null;
  if (!id || !yearMonth || amount == null || !description) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const exp = await prisma.expense.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!exp) return;

  const categoryId = await coerceCategoryId(
    String(formData.get("categoryId") ?? "").trim(),
  );
  const fields = await finalizeExpenseForWrite(
    {
      description,
      tagsJson: commaListToTagsJson(String(formData.get("tags") ?? "")),
      budgetPlanId: budgetPlanIdRaw || null,
      payee,
      categoryId,
      taxCategory: exp.taxCategory,
      autoSuggestCategory: false,
      forceCategoryTaxDefault: true,
    },
    yearMonth,
  );
  const spentAt = spentRaw ? new Date(spentRaw) : exp.spentAt;
  if (Number.isNaN(spentAt.getTime())) return;

  await prisma.expense.update({
    where: { id },
    data: {
      amountCents: amount,
      description,
      spentAt,
      payee: fields.payee,
      categoryId: fields.categoryId,
      budgetPlanId: fields.budgetPlanId,
      taxCategory: fields.taxCategory,
      tagsJson: fields.tagsJson,
    },
  });
  revalidateAll(yearMonth);
  revalidatePath("/tax");
}

/** Re-apply merchant tag rules to every expense in the month (keeps explicit category). */
export async function reapplyMerchantRulesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id },
    select: {
      id: true,
      description: true,
      tagsJson: true,
      categoryId: true,
      budgetPlanId: true,
      taxCategory: true,
      payee: true,
    },
  });
  await reapplyExpenseClassificationForPeriod(period.id, yearMonth, expenses);
  revalidateAll(yearMonth);
  revalidatePath("/tax");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!id || !yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  await prisma.expense.deleteMany({
    where: { id, monthlyPeriodId: period.id },
  });
  revalidateAll(yearMonth);
}
