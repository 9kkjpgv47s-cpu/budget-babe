export function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function stringifyTagsJson(tags: string[]): string | null {
  const uniq = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (uniq.length === 0) return null;
  return JSON.stringify(uniq);
}

export function mergeTagLists(...lists: string[][]): string | null {
  if (lists.length === 0) return null;
  const merged = [
    ...new Set(lists.flat().map((t) => t.trim().toLowerCase()).filter(Boolean)),
  ];
  return stringifyTagsJson(merged);
}

export type ExpenseForRollup = {
  id: string;
  description: string;
  amountCents: number;
  budgetPlanId: string | null;
  tagsJson: string | null;
};

export type BudgetPlanForRollup = {
  id: string;
  name: string;
  category: string | null;
  limitCents: number;
  rolledInCents: number;
};

export function envelopeRemaining(
  plan: BudgetPlanForRollup,
  spent: number,
): number {
  return plan.rolledInCents + plan.limitCents - spent;
}

export function expenseMatchesBudgetPlan(
  e: ExpenseForRollup,
  plan: BudgetPlanForRollup,
): boolean {
  if (e.budgetPlanId && e.budgetPlanId === plan.id) return true;
  const needle = (plan.category || plan.name).toLowerCase();
  if (needle && e.description.toLowerCase().includes(needle)) return true;
  const tags = parseTagsJson(e.tagsJson);
  const pn = plan.name.toLowerCase();
  const pc = (plan.category || "").toLowerCase();
  return tags.some((t) => {
    const tl = t.toLowerCase();
    return (
      tl === pn ||
      pn.includes(tl) ||
      tl.includes(pn) ||
      (!!pc && (tl === pc || pc.includes(tl)))
    );
  });
}

export function spentForBudgetPlan(
  plan: BudgetPlanForRollup,
  expenses: ExpenseForRollup[],
): number {
  return expenses
    .filter((e) => expenseMatchesBudgetPlan(e, plan))
    .reduce((s, e) => s + e.amountCents, 0);
}
