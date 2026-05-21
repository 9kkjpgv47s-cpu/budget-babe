/**
 * Shared entry contract — Agent 1 owns this module.
 * Agents 2–3 import exports; do not rename signatures without coordinating.
 */
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { mergeTagLists } from "@/lib/budgetRollup";

export type ExpenseEntryDefaults = {
  budgetPlanId: string | null;
  tagsJson: string | null;
  payee: string | null;
};

export type MerchantRuleDraft = {
  description: string;
  tagsJson: string | null;
  budgetPlanId: string | null;
  payee: string | null;
};

export type BudgetPlanOption = {
  id: string;
  name: string;
  category: string | null;
};

/** Last expense household-wide (any month). */
export async function getLastExpenseDefaults(): Promise<ExpenseEntryDefaults> {
  const last = await prisma.expense.findFirst({
    orderBy: { spentAt: "desc" },
    select: { budgetPlanId: true, tagsJson: true, payee: true },
  });
  return {
    budgetPlanId: last?.budgetPlanId ?? null,
    tagsJson: last?.tagsJson ?? null,
    payee: last?.payee ?? null,
  };
}

/** Last expense in a calendar month (for overview quick add pre-fill). */
export async function getLastExpenseDefaultsForYearMonth(
  yearMonth: string,
): Promise<ExpenseEntryDefaults> {
  const period = await prisma.monthlyPeriod.findUnique({
    where: { yearMonth },
    select: { id: true },
  });
  if (!period) return getLastExpenseDefaults();
  const last = await prisma.expense.findFirst({
    where: { monthlyPeriodId: period.id },
    orderBy: { spentAt: "desc" },
    select: { budgetPlanId: true, tagsJson: true, payee: true },
  });
  return {
    budgetPlanId: last?.budgetPlanId ?? null,
    tagsJson: last?.tagsJson ?? null,
    payee: last?.payee ?? null,
  };
}

export function commaListToTagsJson(raw: string): string | null {
  const tags = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return tags.length ? mergeTagLists(tags) : null;
}

/** Match budget envelope by category substring or name in description. */
export function suggestBudgetPlanId(
  description: string,
  plans: BudgetPlanOption[],
): string | null {
  const desc = description.toLowerCase();
  for (const p of plans) {
    const cat = p.category?.trim().toLowerCase();
    if (cat && cat.length >= 2 && desc.includes(cat)) return p.id;
    const name = p.name.trim().toLowerCase();
    if (name.length >= 3 && desc.includes(name)) return p.id;
  }
  return null;
}

/** Apply merchant tag rules; optionally suggest budget from envelope match text. */
export async function applyMerchantRulesToDraft(
  draft: MerchantRuleDraft,
  plans?: BudgetPlanOption[],
): Promise<MerchantRuleDraft> {
  const tagsJson = await applyMerchantRulesToTags(
    draft.description,
    draft.tagsJson,
  );
  let budgetPlanId = draft.budgetPlanId;
  if (!budgetPlanId && plans?.length) {
    budgetPlanId = suggestBudgetPlanId(draft.description, plans);
  }
  return { ...draft, tagsJson, budgetPlanId };
}

export type ResolvePostingYearMonthInput = {
  receiptId?: string | null;
  pageYearMonth: string;
};

/** Receipt month wins when posting from a receipt. */
export async function resolvePostingYearMonth(
  input: ResolvePostingYearMonthInput,
): Promise<string> {
  if (!input.receiptId) return input.pageYearMonth;
  const receipt = await prisma.receipt.findUnique({
    where: { id: input.receiptId },
    select: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  return receipt?.monthlyPeriod?.yearMonth ?? input.pageYearMonth;
}

/** Load budget plans for a resolved posting month. */
export async function getBudgetPlansForYearMonth(
  yearMonth: string,
): Promise<BudgetPlanOption[]> {
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  return prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });
}

export async function resolveReceiptPostingContext(
  receiptId: string,
  pageYearMonth: string,
): Promise<{ yearMonth: string; plans: BudgetPlanOption[] }> {
  const yearMonth = await resolvePostingYearMonth({
    receiptId,
    pageYearMonth,
  });
  const plans = await getBudgetPlansForYearMonth(yearMonth);
  return { yearMonth, plans };
}

/** Ensure budget plan belongs to the target month period. */
export async function coerceBudgetPlanInPeriod(
  budgetPlanId: string | null,
  monthlyPeriodId: string,
): Promise<string | null> {
  if (!budgetPlanId) return null;
  const plan = await prisma.budgetPlan.findFirst({
    where: { id: budgetPlanId, monthlyPeriodId },
    select: { id: true },
  });
  return plan?.id ?? null;
}

/**
 * Apply merchant rules + budget suggestion, then validate budget in period.
 * Use from all manual expense create/update paths.
 */
/** Reuse a payee when description contains a recent payee string this month. */
export async function suggestPayeeForDescription(
  description: string,
  monthlyPeriodId: string,
): Promise<string | null> {
  const recent = await prisma.expense.findMany({
    where: { monthlyPeriodId, payee: { not: null } },
    orderBy: { spentAt: "desc" },
    take: 40,
    select: { payee: true },
  });
  const d = description.toLowerCase();
  const seen = new Set<string>();
  for (const row of recent) {
    const p = row.payee?.trim();
    if (!p || p.length < 3 || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    if (d.includes(p.toLowerCase())) return p;
  }
  return null;
}

export async function finalizeExpenseDraftForPeriod(
  draft: MerchantRuleDraft,
  monthlyPeriodId: string,
  plans?: BudgetPlanOption[],
): Promise<MerchantRuleDraft> {
  const withRules = await applyMerchantRulesToDraft(draft, plans);
  const budgetPlanId = await coerceBudgetPlanInPeriod(
    withRules.budgetPlanId,
    monthlyPeriodId,
  );
  let payee = withRules.payee;
  if (!payee?.trim() && draft.description.trim()) {
    payee = await suggestPayeeForDescription(draft.description, monthlyPeriodId);
  }
  return { ...withRules, budgetPlanId, payee: payee ?? null };
}

export function expenseDefaultsFromDraft(
  draft: MerchantRuleDraft,
): ExpenseEntryDefaults {
  return {
    budgetPlanId: draft.budgetPlanId,
    tagsJson: draft.tagsJson,
    payee: draft.payee,
  };
}

/**
 * When an expense moves to another month, map budget by envelope name in the target month.
 */
export async function remapBudgetPlanToPeriod(
  budgetPlanId: string | null,
  sourceMonthlyPeriodId: string,
  targetMonthlyPeriodId: string,
): Promise<string | null> {
  if (!budgetPlanId) return null;
  if (sourceMonthlyPeriodId === targetMonthlyPeriodId) {
    return coerceBudgetPlanInPeriod(budgetPlanId, targetMonthlyPeriodId);
  }
  const source = await prisma.budgetPlan.findFirst({
    where: { id: budgetPlanId, monthlyPeriodId: sourceMonthlyPeriodId },
    select: { name: true },
  });
  if (!source) return null;
  const target = await prisma.budgetPlan.findFirst({
    where: { monthlyPeriodId: targetMonthlyPeriodId, name: source.name },
    select: { id: true },
  });
  return target?.id ?? null;
}

/** Sanitize defaults when a budget line was deleted or month has no plans yet. */
export function sanitizeExpenseDefaultsForPlans(
  defaults: ExpenseEntryDefaults,
  planIds: Set<string> | string[],
): ExpenseEntryDefaults {
  const ids = planIds instanceof Set ? planIds : new Set(planIds);
  return {
    ...defaults,
    budgetPlanId:
      defaults.budgetPlanId && ids.has(defaults.budgetPlanId)
        ? defaults.budgetPlanId
        : null,
  };
}
