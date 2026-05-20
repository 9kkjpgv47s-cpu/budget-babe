import type { ExpenseForRollup } from "@/lib/budgetRollup";

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
