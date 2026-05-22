/**
 * Expense write pipeline — delegates to Agent 1 `finalizeExpenseForWrite` in entryDefaults.
 */
import {
  finalizeExpenseForWrite,
  getBudgetPlansForYearMonth,
  type FinalizeExpenseInput,
  type MerchantRuleDraft,
} from "@/lib/entryDefaults";
import { classifyExpenseForWrite } from "@/lib/merchantRules";
import type { CategoryFieldPatch } from "@/lib/categories";

export type ClassifiedExpenseWrite = CategoryFieldPatch & {
  tagsJson: string | null;
  payee: string | null;
};

export type FinalizeClassifiedOpts = {
  categoryId?: string | null;
  taxCategory?: string | null;
  autoSuggest?: boolean;
  forceCategoryDefaults?: boolean;
};

/** Entry defaults → merchant/category classify → optional forced category patch. */
export async function finalizeClassifiedExpenseWrite(
  draft: MerchantRuleDraft,
  monthlyPeriodId: string,
  yearMonth: string,
  opts?: FinalizeClassifiedOpts,
): Promise<ClassifiedExpenseWrite> {
  void monthlyPeriodId;
  const input: FinalizeExpenseInput = {
    description: draft.description,
    tagsJson: draft.tagsJson,
    budgetPlanId: draft.budgetPlanId,
    payee: draft.payee,
    categoryId: opts?.categoryId ?? null,
    taxCategory: opts?.taxCategory ?? null,
    autoSuggestCategory: opts?.autoSuggest,
  };
  if (opts?.forceCategoryDefaults === false && input.categoryId) {
    const plans = await getBudgetPlansForYearMonth(yearMonth);
    const withRules = await finalizeExpenseForWrite(
      { ...input, autoSuggestCategory: false },
      yearMonth,
    );
    const classified = await classifyExpenseForWrite(
      draft.description,
      monthlyPeriodId,
      {
        categoryId: input.categoryId,
        tagsJson: withRules.tagsJson,
        budgetPlanId: withRules.budgetPlanId,
        taxCategory: input.taxCategory,
        autoSuggest: false,
      },
    );
    return {
      categoryId: classified.categoryId,
      budgetPlanId: classified.budgetPlanId ?? withRules.budgetPlanId,
      taxCategory: classified.taxCategory,
      tagsJson: classified.tagsJson,
      payee: withRules.payee,
    };
  }
  const fields = await finalizeExpenseForWrite(input, yearMonth);
  return {
    categoryId: fields.categoryId,
    budgetPlanId: fields.budgetPlanId,
    taxCategory: fields.taxCategory,
    tagsJson: fields.tagsJson,
    payee: fields.payee,
  };
}

export type ReapplyClassificationResult = {
  scanned: number;
  updated: number;
  categoriesSet: number;
};

type ExpenseRow = {
  id: string;
  description: string;
  tagsJson: string | null;
  categoryId: string | null;
  budgetPlanId: string | null;
  taxCategory: string | null;
  payee: string | null;
};

/** Re-run entry defaults + classification for all expenses in a month. */
export async function reapplyExpenseClassificationForPeriod(
  monthlyPeriodId: string,
  yearMonth: string,
  expenses: ExpenseRow[],
): Promise<ReapplyClassificationResult> {
  void monthlyPeriodId;
  const { applyEntryDefaultsToExistingExpenses } = await import(
    "@/lib/entryDefaults"
  );
  const result = await applyEntryDefaultsToExistingExpenses(
    monthlyPeriodId,
    yearMonth,
  );
  return {
    scanned: result.scanned,
    updated: result.updated,
    categoriesSet: result.categorySet,
  };
}
