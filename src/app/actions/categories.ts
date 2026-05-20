"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ensureDefaultCategories,
  resolveBudgetPlanIdForCategory,
  slugifyCategoryName,
} from "@/lib/categories";
import { isValidTaxCategory } from "@/lib/taxCategories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { classifyExpenseForWrite } from "@/lib/merchantRules";

function revalidateCategoryPaths(yearMonth?: string) {
  revalidatePath("/budgets");
  revalidatePath("/import");
  revalidatePath("/expenses");
  if (yearMonth) revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/insights");
  revalidatePath("/");
}

export async function addCategoryAction(formData: FormData): Promise<void> {
  await requireUser();
  await ensureDefaultCategories();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  let slug = slugifyCategoryName(String(formData.get("slug") ?? "") || name);
  const matchText = String(formData.get("matchText") ?? "").trim() || null;
  const budgetEnvelopeName =
    String(formData.get("budgetEnvelopeName") ?? "").trim() || null;
  const taxRaw = String(formData.get("defaultTaxCategory") ?? "").trim();
  const defaultTaxCategory =
    taxRaw && isValidTaxCategory(taxRaw) ? taxRaw : null;

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }
  const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
  await prisma.category.create({
    data: {
      name,
      slug,
      matchText,
      budgetEnvelopeName,
      defaultTaxCategory,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  revalidateCategoryPaths();
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const matchText = String(formData.get("matchText") ?? "").trim() || null;
  const budgetEnvelopeName =
    String(formData.get("budgetEnvelopeName") ?? "").trim() || null;
  const taxRaw = String(formData.get("defaultTaxCategory") ?? "").trim();
  const defaultTaxCategory =
    taxRaw && isValidTaxCategory(taxRaw) ? taxRaw : null;
  await prisma.category.update({
    where: { id },
    data: { name, matchText, budgetEnvelopeName, defaultTaxCategory },
  });
  revalidateCategoryPaths();
}

export async function syncCategoryEnvelopesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const expenses = await prisma.expense.findMany({
    where: {
      monthlyPeriodId: period.id,
      categoryId: { not: null },
      budgetPlanId: null,
    },
    select: { id: true, categoryId: true, taxCategory: true },
  });
  for (const exp of expenses) {
    if (!exp.categoryId) continue;
    const budgetPlanId = await resolveBudgetPlanIdForCategory(
      exp.categoryId,
      period.id,
    );
    if (!budgetPlanId) continue;
    await prisma.expense.update({
      where: { id: exp.id },
      data: { budgetPlanId },
    });
  }
  revalidateCategoryPaths(yearMonth);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.category.delete({ where: { id } });
  revalidateCategoryPaths();
}

export async function bulkApplyCategoryRulesAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  await ensureDefaultCategories();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);

  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id, categoryId: null },
    select: {
      id: true,
      description: true,
      tagsJson: true,
      budgetPlanId: true,
      taxCategory: true,
    },
  });

  for (const exp of expenses) {
    const classified = await classifyExpenseForWrite(exp.description, period.id, {
      tagsJson: exp.tagsJson,
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    });
    if (!classified.categoryId) continue;
    let budgetPlanId = classified.budgetPlanId;
    if (!budgetPlanId && classified.categoryId) {
      budgetPlanId = await resolveBudgetPlanIdForCategory(
        classified.categoryId,
        period.id,
      );
    }
    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        categoryId: classified.categoryId,
        budgetPlanId,
        taxCategory: classified.taxCategory,
        tagsJson: classified.tagsJson,
      },
    });
  }
  revalidateCategoryPaths(yearMonth);
}
