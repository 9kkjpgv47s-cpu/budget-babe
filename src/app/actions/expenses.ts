"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";
import {
  applyMerchantRulesToTags,
  classifyExpenseForWrite,
} from "@/lib/merchantRules";
import { fieldsFromCategoryId } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

function revalidateAll(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/import");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
  revalidatePath("/tax");
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
    const classified = await classifyExpenseForWrite(exp.description, period.id, {
      categoryId: exp.categoryId,
      tagsJson: manual,
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    });
    await prisma.expense.update({
      where: { id },
      data: {
        tagsJson: classified.tagsJson,
        categoryId: classified.categoryId,
        budgetPlanId: classified.budgetPlanId,
        taxCategory: classified.taxCategory,
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
    await prisma.expense.update({ where: { id }, data: { budgetPlanId } });
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
    const patch = await fieldsFromCategoryId(categoryId, period.id, {
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    });
    let budgetPlanId = patch.budgetPlanId;
    if (categoryId && !budgetPlanId) {
      const classified = await classifyExpenseForWrite(exp.description, period.id, {
        categoryId,
        tagsJson: exp.tagsJson,
      });
      budgetPlanId = classified.budgetPlanId;
    }
    await prisma.expense.update({
      where: { id },
      data: {
        categoryId: patch.categoryId,
        budgetPlanId,
        taxCategory: patch.taxCategory,
      },
    });
  }
  revalidateAll(yearMonth);
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const spentRaw = String(formData.get("spentAt") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!id || !yearMonth || amount == null || !description) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const exp = await prisma.expense.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!exp) return;

  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }

  let categoryId: string | null = categoryIdRaw || null;
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) categoryId = null;
  }

  const tagsRaw = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const manual = tagsRaw.length ? mergeTagLists(tagsRaw) : exp.tagsJson;

  const classified = await classifyExpenseForWrite(description, period.id, {
    categoryId,
    tagsJson: manual,
    budgetPlanId: budgetPlanId ?? exp.budgetPlanId,
    taxCategory: exp.taxCategory,
    autoSuggest: false,
  });

  const spentAt = spentRaw ? new Date(spentRaw) : exp.spentAt;
  if (Number.isNaN(spentAt.getTime())) return;

  await prisma.expense.update({
    where: { id },
    data: {
      amountCents: amount,
      description,
      spentAt,
      categoryId: classified.categoryId,
      budgetPlanId: classified.budgetPlanId,
      taxCategory: classified.taxCategory,
      tagsJson: classified.tagsJson,
    },
  });
  revalidateAll(yearMonth);
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
    },
  });
  for (const exp of expenses) {
    const tagsJson = await applyMerchantRulesToTags(exp.description, exp.tagsJson);
    await prisma.expense.update({
      where: { id: exp.id },
      data: { tagsJson },
    });
    if (exp.categoryId) continue;
    const classified = await classifyExpenseForWrite(exp.description, period.id, {
      tagsJson,
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    });
    if (!classified.categoryId) continue;
    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        categoryId: classified.categoryId,
        budgetPlanId: classified.budgetPlanId,
        taxCategory: classified.taxCategory,
        tagsJson: classified.tagsJson,
      },
    });
  }
  revalidateAll(yearMonth);
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
