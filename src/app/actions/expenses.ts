"use server";

import { revalidatePath } from "next/cache";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";
import { commaListToTagsJson } from "@/lib/entryDefaults";
import { classifyExpenseForWrite } from "@/lib/merchantRules";
import { fieldsFromCategoryId } from "@/lib/categories";
import {
  finalizeClassifiedExpenseWrite,
  reapplyExpenseClassificationForPeriod,
} from "@/lib/expenseWrite";
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
    const write = await finalizeClassifiedExpenseWrite(
      {
        description: exp.description,
        tagsJson: manual ?? exp.tagsJson,
        budgetPlanId: exp.budgetPlanId,
        payee: exp.payee,
      },
      period.id,
      yearMonth,
      { categoryId: exp.categoryId, taxCategory: exp.taxCategory },
    );
    await prisma.expense.update({
      where: { id },
      data: {
        tagsJson: write.tagsJson,
        categoryId: write.categoryId,
        budgetPlanId: write.budgetPlanId,
        taxCategory: write.taxCategory,
        payee: write.payee,
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
    const write = await finalizeClassifiedExpenseWrite(
      {
        description: exp.description,
        tagsJson: exp.tagsJson,
        budgetPlanId,
        payee: exp.payee,
      },
      period.id,
      yearMonth,
      {
        categoryId: exp.categoryId,
        taxCategory: exp.taxCategory,
        autoSuggest: false,
      },
    );
    await prisma.expense.update({
      where: { id },
      data: {
        budgetPlanId: write.budgetPlanId,
        tagsJson: write.tagsJson,
        payee: write.payee,
        categoryId: write.categoryId,
        taxCategory: write.taxCategory,
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
  const categoryId: string | null = raw && raw !== "none" ? raw : null;
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return;
  }
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    const applyTax =
      String(formData.get("applyTaxFromCategory") ?? "on") === "on";
    const patch = await fieldsFromCategoryId(
      categoryId,
      period.id,
      {
        budgetPlanId: exp.budgetPlanId,
        taxCategory: exp.taxCategory,
      },
      categoryId
        ? { forceTaxDefault: applyTax, forceBudgetLink: true }
        : undefined,
    );
    let tagsJson = exp.tagsJson;
    if (categoryId) {
      const classified = await classifyExpenseForWrite(exp.description, period.id, {
        categoryId,
        tagsJson: exp.tagsJson,
        autoSuggest: false,
      });
      tagsJson = classified.tagsJson;
    }
    await prisma.expense.update({
      where: { id },
      data: {
        categoryId: patch.categoryId,
        budgetPlanId: patch.budgetPlanId,
        taxCategory: patch.taxCategory,
        tagsJson,
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
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!id || !yearMonth || amount == null || !description) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const exp = await prisma.expense.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!exp) return;

  let categoryId: string | null = categoryIdRaw || null;
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) categoryId = null;
  }
  const write = await finalizeClassifiedExpenseWrite(
    {
      description,
      tagsJson: commaListToTagsJson(String(formData.get("tags") ?? "")),
      budgetPlanId: budgetPlanIdRaw || null,
      payee,
    },
    period.id,
    yearMonth,
    { categoryId, taxCategory: exp.taxCategory, autoSuggest: false },
  );
  const spentAt = spentRaw ? new Date(spentRaw) : exp.spentAt;
  if (Number.isNaN(spentAt.getTime())) return;

  await prisma.expense.update({
    where: { id },
    data: {
      amountCents: amount,
      description,
      spentAt,
      payee: write.payee,
      categoryId: write.categoryId,
      budgetPlanId: write.budgetPlanId,
      taxCategory: write.taxCategory,
      tagsJson: write.tagsJson,
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
