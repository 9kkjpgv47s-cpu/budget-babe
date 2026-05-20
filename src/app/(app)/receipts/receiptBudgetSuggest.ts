export type BudgetPlanPick = {
  id: string;
  name: string;
  category: string | null;
};

/** Match budget envelope by category substring or plan name (same rules as rollup). */
export function suggestBudgetPlanId(
  description: string,
  plans: BudgetPlanPick[],
): string | null {
  const desc = description.toLowerCase().trim();
  if (!desc || plans.length === 0) return null;

  for (const plan of plans) {
    const needle = (plan.category || "").trim().toLowerCase();
    if (needle.length >= 2 && desc.includes(needle)) return plan.id;
  }
  for (const plan of plans) {
    const name = plan.name.trim().toLowerCase();
    if (name.length >= 3 && desc.includes(name)) return plan.id;
  }
  return null;
}
