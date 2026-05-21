import { prisma } from "@/lib/prisma";
import type { ExpenseForRollup } from "@/lib/budgetRollup";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

export type ExpenseWithCategory = {
  id: string;
  description: string;
  amountCents: number;
  budgetPlanId: string | null;
  categoryId: string | null;
  tagsJson: string | null;
};

export type CategoryEnvelopeLookup = Map<
  string,
  { budgetEnvelopeName: string | null }
>;

export function buildCategoryEnvelopeLookup(
  categories: { id: string; budgetEnvelopeName: string | null }[],
): CategoryEnvelopeLookup {
  return new Map(categories.map((c) => [c.id, { budgetEnvelopeName: c.budgetEnvelopeName }]));
}

/** Load expenses for a month as budget-rollups with category envelope matching. */
export async function loadExpenseRollupsForYearMonth(
  yearMonth: string,
): Promise<ExpenseForRollup[]> {
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where: { monthlyPeriodId: period.id },
      select: {
        id: true,
        description: true,
        amountCents: true,
        budgetPlanId: true,
        categoryId: true,
        tagsJson: true,
      },
    }),
    prisma.category.findMany({
      select: { id: true, budgetEnvelopeName: true },
    }),
  ]);
  const lookup = buildCategoryEnvelopeLookup(categories);
  return expenses.map((e) => toExpenseForRollup(e, lookup));
}

/** Load rollups for a period id (e.g. prior month in rollover). */
export async function loadExpenseRollupsForPeriodId(
  monthlyPeriodId: string,
): Promise<ExpenseForRollup[]> {
  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where: { monthlyPeriodId },
      select: {
        id: true,
        description: true,
        amountCents: true,
        budgetPlanId: true,
        categoryId: true,
        tagsJson: true,
      },
    }),
    prisma.category.findMany({
      select: { id: true, budgetEnvelopeName: true },
    }),
  ]);
  const lookup = buildCategoryEnvelopeLookup(categories);
  return expenses.map((e) => toExpenseForRollup(e, lookup));
}

export function toExpenseForRollup(
  e: ExpenseWithCategory,
  categoryById: CategoryEnvelopeLookup,
): ExpenseForRollup {
  const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
  return {
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    budgetPlanId: e.budgetPlanId,
    categoryId: e.categoryId,
    categoryEnvelopeName: cat?.budgetEnvelopeName ?? null,
    tagsJson: e.tagsJson,
  };
}
