"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  applyCategoryDefaultsToExpense,
  ensureDefaultCategories,
  fieldsFromCategoryId,
  linkCategoriesToBudgetEnvelope,
  resolveBudgetPlanIdForCategory,
  slugifyCategoryName,
} from "@/lib/categories";
import { isValidTaxCategory } from "@/lib/taxCategories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { classifyUncategorizedForPeriod } from "@/lib/expenseWrite";

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
  let budgetEnvelopeName =
    String(formData.get("budgetEnvelopeName") ?? "").trim() || null;
  if (!budgetEnvelopeName) budgetEnvelopeName = name;
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
  await linkCategoriesToBudgetEnvelope(budgetEnvelopeName);
  revalidateCategoryPaths();
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const matchText = String(formData.get("matchText") ?? "").trim() || null;
  let budgetEnvelopeName =
    String(formData.get("budgetEnvelopeName") ?? "").trim() || null;
  if (!budgetEnvelopeName) budgetEnvelopeName = name;
  const taxRaw = String(formData.get("defaultTaxCategory") ?? "").trim();
  const defaultTaxCategory =
    taxRaw && isValidTaxCategory(taxRaw) ? taxRaw : null;
  await prisma.category.update({
    where: { id },
    data: { name, matchText, budgetEnvelopeName, defaultTaxCategory },
  });
  revalidateCategoryPaths();
}

/** Apply each expense's category default tax folder (overwrites existing tax folder). */
export async function bulkSyncTaxFromCategoriesAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id, categoryId: { not: null } },
    select: { id: true, categoryId: true },
  });
  for (const exp of expenses) {
    if (!exp.categoryId) continue;
    await applyCategoryDefaultsToExpense(exp.id, period.id, exp.categoryId, {
      forceTaxDefault: true,
      forceBudgetLink: true,
    });
  }
  revalidateCategoryPaths(yearMonth);
  revalidatePath("/tax");
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
  const used = await prisma.expense.count({ where: { categoryId: id } });
  if (used > 0) return;
  await prisma.merchantRule.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id } });
  revalidateCategoryPaths();
}

/** Create budget envelopes for categories that have budgetEnvelopeName but no matching plan this month. */
export async function createMissingCategoryEnvelopesAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const limitRaw = String(formData.get("defaultLimit") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const categories = await prisma.category.findMany({
    where: { budgetEnvelopeName: { not: null } },
  });
  const plans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    select: { name: true },
  });
  const planNames = new Set(plans.map((p) => p.name.toLowerCase()));
  const limitCents = limitRaw
    ? Math.round(Number.parseFloat(limitRaw.replace(/[$,]/g, "")) * 100)
    : 0;
  const safeLimit = Number.isFinite(limitCents) && limitCents >= 0 ? limitCents : 0;

  for (const cat of categories) {
    const env = cat.budgetEnvelopeName?.trim();
    if (!env || planNames.has(env.toLowerCase())) continue;
    await prisma.budgetPlan.create({
      data: {
        monthlyPeriodId: period.id,
        name: env,
        category: cat.matchText ?? cat.slug,
        limitCents: safeLimit,
        note: `Auto-created for category “${cat.name}”`,
      },
    });
    planNames.add(env.toLowerCase());
  }
  const linked = await prisma.expense.findMany({
    where: {
      monthlyPeriodId: period.id,
      categoryId: { not: null },
      budgetPlanId: null,
    },
    select: { id: true, categoryId: true },
  });
  for (const exp of linked) {
    if (!exp.categoryId) continue;
    const budgetPlanId = await resolveBudgetPlanIdForCategory(
      exp.categoryId,
      period.id,
    );
    if (budgetPlanId) {
      await prisma.expense.update({
        where: { id: exp.id },
        data: { budgetPlanId },
      });
    }
  }
  revalidateCategoryPaths(yearMonth);
}

export async function bulkApplyCategoryRulesAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  await ensureDefaultCategories();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);

  const { categorized, scanned } = await classifyUncategorizedForPeriod(period.id);
  revalidateCategoryPaths(yearMonth);
  revalidatePath("/tax");
  const params = new URLSearchParams({ ym: yearMonth });
  if (categorized > 0) {
    params.set("classified", String(categorized));
  } else {
    params.set("classified", "0");
    params.set("scanned", String(scanned));
  }
  redirect(`/expenses?${params.toString()}`);
}
