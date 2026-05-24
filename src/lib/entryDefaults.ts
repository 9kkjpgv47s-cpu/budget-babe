/**
 * Shared entry contract — Agent 1 owns this module.
 * Agents 2–3 import exports; do not rename signatures without coordinating.
 */
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import {
  fieldsFromCategoryId,
  remapExpenseCategoryFieldsToPeriod,
} from "@/lib/categories";
import {
  applyMerchantRulesToTags,
  classifyExpenseForWrite,
} from "@/lib/merchantRules";
import { mergeTagLists } from "@/lib/budgetRollup";

export type ExpenseEntryDefaults = {
  budgetPlanId: string | null;
  tagsJson: string | null;
  payee: string | null;
  categoryId: string | null;
};

export type ExpenseWriteFields = {
  payee: string | null;
  categoryId: string | null;
  budgetPlanId: string | null;
  taxCategory: string | null;
  tagsJson: string | null;
};

export type FinalizeExpenseInput = {
  description: string;
  tagsJson?: string | null;
  budgetPlanId?: string | null;
  payee?: string | null;
  categoryId?: string | null;
  taxCategory?: string | null;
  /** When false, only use explicit categoryId (edits). Default true for creates. */
  autoSuggestCategory?: boolean;
  /** When category is set, apply category tax default (default true). */
  forceCategoryTaxDefault?: boolean;
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
    select: {
      budgetPlanId: true,
      tagsJson: true,
      payee: true,
      categoryId: true,
    },
  });
  return {
    budgetPlanId: last?.budgetPlanId ?? null,
    tagsJson: last?.tagsJson ?? null,
    payee: last?.payee ?? null,
    categoryId: last?.categoryId ?? null,
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
    select: {
      budgetPlanId: true,
      tagsJson: true,
      payee: true,
      categoryId: true,
    },
  });
  return {
    budgetPlanId: last?.budgetPlanId ?? null,
    tagsJson: last?.tagsJson ?? null,
    payee: last?.payee ?? null,
    categoryId: last?.categoryId ?? null,
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

export function expenseDefaultsFromWrite(
  fields: ExpenseWriteFields,
): ExpenseEntryDefaults {
  return {
    budgetPlanId: fields.budgetPlanId,
    tagsJson: fields.tagsJson,
    payee: fields.payee,
    categoryId: fields.categoryId,
  };
}

/** Prisma columns shared by all expense creates after propagation. */
export function expensePropagatedData(fields: ExpenseWriteFields) {
  return {
    payee: fields.payee,
    categoryId: fields.categoryId,
    budgetPlanId: fields.budgetPlanId,
    taxCategory: fields.taxCategory,
    tagsJson: fields.tagsJson,
  };
}

/** Short feedback for quick-add / receipt post success banners. */
export function propagationSummaryFromFields(
  fields: ExpenseWriteFields,
): string | undefined {
  const parts: string[] = [];
  if (fields.categoryId) parts.push("category");
  if (fields.budgetPlanId) parts.push("budget");
  if (fields.taxCategory) parts.push("tax");
  if (fields.tagsJson) parts.push("tags");
  if (fields.payee) parts.push("payee");
  if (parts.length === 0) return undefined;
  return `Applied ${parts.join(", ")} from rules and defaults.`;
}

export function expenseDefaultsFromDraft(
  draft: MerchantRuleDraft,
  categoryId?: string | null,
): ExpenseEntryDefaults {
  return {
    budgetPlanId: draft.budgetPlanId,
    tagsJson: draft.tagsJson,
    payee: draft.payee,
    categoryId: categoryId ?? null,
  };
}

/**
 * Full propagation: merchant rules, budget suggestion, payee, and category classification.
 */
export async function finalizeExpenseForWrite(
  input: FinalizeExpenseInput,
  yearMonth: string,
): Promise<ExpenseWriteFields> {
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const plans = await getBudgetPlansForYearMonth(yearMonth);
  const description = input.description.trim();
  const draft = await finalizeExpenseDraftForPeriod(
    {
      description,
      tagsJson: input.tagsJson ?? null,
      budgetPlanId: input.budgetPlanId ?? null,
      payee: input.payee ?? null,
    },
    period.id,
    plans,
  );
  const classified = await classifyExpenseForWrite(description, period.id, {
    categoryId: input.categoryId ?? null,
    tagsJson: draft.tagsJson,
    budgetPlanId: draft.budgetPlanId,
    taxCategory: input.taxCategory ?? null,
    autoSuggest: input.autoSuggestCategory,
  });
  let finalBudget = classified.budgetPlanId ?? draft.budgetPlanId;
  let finalTax = classified.taxCategory;
  if (classified.categoryId) {
    const forceTax = input.forceCategoryTaxDefault !== false;
    const patch = await fieldsFromCategoryId(
      classified.categoryId,
      period.id,
      {
        budgetPlanId: finalBudget,
        taxCategory: finalTax,
      },
      { forceTaxDefault: forceTax, forceBudgetLink: true },
    );
    finalBudget = patch.budgetPlanId;
    finalTax = patch.taxCategory;
  }
  return {
    payee: draft.payee,
    categoryId: classified.categoryId,
    budgetPlanId: finalBudget,
    taxCategory: finalTax,
    tagsJson: classified.tagsJson,
  };
}

/**
 * Bank/file import hook (Plaid, CSV, OFX). Agent 3 calls this from `plaidSync` / import paths —
 * do not duplicate tag-only `applyMerchantRulesToTags` for new rows.
 */
export async function finalizeImportedExpense(
  input: {
    description: string;
    payee?: string | null;
    tagsJson?: string | null;
    categoryId?: string | null;
  },
  yearMonth: string,
): Promise<ExpenseWriteFields> {
  const last = await getLastExpenseDefaultsForYearMonth(yearMonth);
  return finalizeExpenseForWrite(
    {
      description: input.description,
      tagsJson: input.tagsJson ?? last.tagsJson,
      budgetPlanId: last.budgetPlanId,
      payee: input.payee ?? last.payee,
      categoryId: input.categoryId ?? last.categoryId,
      autoSuggestCategory: input.categoryId == null && last.categoryId == null,
    },
    yearMonth,
  );
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

/**
 * When a linked expense moves with its receipt, remap budget to the target month
 * and re-run classification so category → budget/tax links match the new period.
 */
export async function propagateExpenseToTargetPeriod(
  expense: {
    description: string;
    tagsJson: string | null;
    budgetPlanId: string | null;
    payee: string | null;
    categoryId: string | null;
    taxCategory: string | null;
  },
  sourceMonthlyPeriodId: string,
  targetMonthlyPeriodId: string,
  targetYearMonth: string,
): Promise<ExpenseWriteFields> {
  const remappedBudget = await remapBudgetPlanToPeriod(
    expense.budgetPlanId,
    sourceMonthlyPeriodId,
    targetMonthlyPeriodId,
  );
  const categoryPatch = await remapExpenseCategoryFieldsToPeriod(
    expense.categoryId,
    targetMonthlyPeriodId,
    { budgetPlanId: remappedBudget, taxCategory: expense.taxCategory },
  );
  return finalizeExpenseForWrite(
    {
      description: expense.description,
      tagsJson: expense.tagsJson,
      budgetPlanId: categoryPatch.budgetPlanId ?? remappedBudget,
      payee: expense.payee,
      categoryId: categoryPatch.categoryId,
      taxCategory: categoryPatch.taxCategory,
      autoSuggestCategory: false,
    },
    targetYearMonth,
  );
}

/** Sanitize defaults when a budget line was deleted or month has no plans yet. */
export function sanitizeExpenseDefaultsForPlans(
  defaults: ExpenseEntryDefaults,
  planIds: Set<string> | string[],
  categoryIds?: Set<string> | string[],
): ExpenseEntryDefaults {
  const ids = planIds instanceof Set ? planIds : new Set(planIds);
  const catIds = categoryIds
    ? categoryIds instanceof Set
      ? categoryIds
      : new Set(categoryIds)
    : null;
  return {
    ...defaults,
    budgetPlanId:
      defaults.budgetPlanId && ids.has(defaults.budgetPlanId)
        ? defaults.budgetPlanId
        : null,
    categoryId:
      defaults.categoryId && catIds && !catIds.has(defaults.categoryId)
        ? null
        : defaults.categoryId,
  };
}

/** Best-effort description when posting a receipt to the ledger. */
export function suggestReceiptExpenseDescription(receipt: {
  filename: string;
  note: string | null;
  ocrParsedLines: string | null;
}): string {
  if (receipt.note?.trim()) return receipt.note.trim().slice(0, 500);
  if (receipt.ocrParsedLines?.trim()) {
    try {
      const lines = JSON.parse(receipt.ocrParsedLines) as {
        description?: string;
      }[];
      if (Array.isArray(lines)) {
        const first = lines.find((l) => String(l.description ?? "").trim());
        if (first?.description) {
          return String(first.description).trim().slice(0, 500);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return `Receipt: ${receipt.filename}`;
}

export type ApplyDefaultsResult = {
  updated: number;
  scanned: number;
  tagsChanged: number;
  budgetLinked: number;
  payeeSet: number;
  categorySet: number;
};

/**
 * Re-apply merchant rules, budget suggestion, and payee hints to existing rows in a month.
 */
export async function applyEntryDefaultsToExistingExpenses(
  monthlyPeriodId: string,
  yearMonth: string,
): Promise<ApplyDefaultsResult> {
  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId },
    select: {
      id: true,
      description: true,
      tagsJson: true,
      budgetPlanId: true,
      payee: true,
      categoryId: true,
      taxCategory: true,
    },
  });

  let updated = 0;
  let tagsChanged = 0;
  let budgetLinked = 0;
  let payeeSet = 0;
  let categorySet = 0;

  for (const exp of expenses) {
    const fields = await finalizeExpenseForWrite(
      {
        description: exp.description,
        tagsJson: exp.tagsJson,
        budgetPlanId: exp.budgetPlanId,
        payee: exp.payee,
        categoryId: exp.categoryId,
        taxCategory: exp.taxCategory,
        autoSuggestCategory: !exp.categoryId,
      },
      yearMonth,
    );
    const tagsSame = (fields.tagsJson ?? null) === (exp.tagsJson ?? null);
    const budgetSame = (fields.budgetPlanId ?? null) === (exp.budgetPlanId ?? null);
    const payeeSame = (fields.payee ?? null) === (exp.payee ?? null);
    const catSame = (fields.categoryId ?? null) === (exp.categoryId ?? null);
    const taxSame = (fields.taxCategory ?? null) === (exp.taxCategory ?? null);
    if (tagsSame && budgetSame && payeeSame && catSame && taxSame) continue;

    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        tagsJson: fields.tagsJson,
        budgetPlanId: fields.budgetPlanId,
        payee: fields.payee,
        categoryId: fields.categoryId,
        taxCategory: fields.taxCategory,
      },
    });
    updated += 1;
    if (!tagsSame) tagsChanged += 1;
    if (!budgetSame && fields.budgetPlanId) budgetLinked += 1;
    if (!payeeSame && fields.payee) payeeSet += 1;
    if (!catSame && fields.categoryId) categorySet += 1;
  }

  return {
    updated,
    scanned: expenses.length,
    tagsChanged,
    budgetLinked,
    payeeSet,
    categorySet,
  };
}
