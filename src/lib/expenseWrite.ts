/**
 * Expense write pipeline — entry defaults (Agent 1) then category classification (Agent 3).
 */
import { prisma } from "@/lib/prisma";
import {
  finalizeExpenseDraftForPeriod,
  getBudgetPlansForYearMonth,
  type MerchantRuleDraft,
} from "@/lib/entryDefaults";
import {
  fieldsFromCategoryId,
  type CategoryFieldPatch,
} from "@/lib/categories";
import { classifyExpenseForWrite } from "@/lib/merchantRules";

export type ClassifiedExpenseWrite = CategoryFieldPatch & {
  tagsJson: string | null;
  payee: string | null;
};

export type FinalizeClassifiedOpts = {
  categoryId?: string | null;
  taxCategory?: string | null;
  /** When false, do not infer category from rules (edits with explicit clear). */
  autoSuggest?: boolean;
  /** Apply category tax folder + envelope link when categoryId is set. */
  forceCategoryDefaults?: boolean;
};

/** Entry defaults → merchant/category classify → optional forced category patch. */
export async function finalizeClassifiedExpenseWrite(
  draft: MerchantRuleDraft,
  monthlyPeriodId: string,
  yearMonth: string,
  opts?: FinalizeClassifiedOpts,
): Promise<ClassifiedExpenseWrite> {
  const plans = await getBudgetPlansForYearMonth(yearMonth);
  const finalized = await finalizeExpenseDraftForPeriod(draft, monthlyPeriodId, plans);
  const classified = await classifyExpenseForWrite(
    finalized.description,
    monthlyPeriodId,
    {
      categoryId: opts?.categoryId ?? null,
      tagsJson: finalized.tagsJson,
      budgetPlanId: finalized.budgetPlanId,
      taxCategory: opts?.taxCategory,
      autoSuggest: opts?.autoSuggest,
    },
  );

  let categoryId = classified.categoryId;
  let budgetPlanId = classified.budgetPlanId ?? finalized.budgetPlanId;
  let taxCategory = classified.taxCategory;

  if (categoryId && opts?.forceCategoryDefaults !== false) {
    const patch = await fieldsFromCategoryId(
      categoryId,
      monthlyPeriodId,
      { budgetPlanId, taxCategory },
      { forceTaxDefault: true, forceBudgetLink: true },
    );
    categoryId = patch.categoryId;
    budgetPlanId = patch.budgetPlanId;
    taxCategory = patch.taxCategory;
  }

  return {
    categoryId,
    budgetPlanId,
    taxCategory,
    tagsJson: classified.tagsJson,
    payee: finalized.payee,
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

/** Re-run entry defaults + tags + category rules for all expenses in a month. */
export async function reapplyExpenseClassificationForPeriod(
  monthlyPeriodId: string,
  yearMonth: string,
  expenses: ExpenseRow[],
): Promise<ReapplyClassificationResult> {
  const plans = await getBudgetPlansForYearMonth(yearMonth);
  let updated = 0;
  let categoriesSet = 0;

  for (const exp of expenses) {
    const finalized = await finalizeExpenseDraftForPeriod(
      {
        description: exp.description,
        tagsJson: exp.tagsJson,
        budgetPlanId: exp.budgetPlanId,
        payee: exp.payee,
      },
      monthlyPeriodId,
      plans,
    );

    const classified = await classifyExpenseForWrite(exp.description, monthlyPeriodId, {
      categoryId: exp.categoryId,
      tagsJson: finalized.tagsJson,
      budgetPlanId: finalized.budgetPlanId,
      taxCategory: exp.taxCategory,
      autoSuggest: !exp.categoryId,
    });

    let categoryId = exp.categoryId ?? classified.categoryId;
    let budgetPlanId = classified.budgetPlanId ?? finalized.budgetPlanId;
    let taxCategory = classified.taxCategory;
    const tagsJson = classified.tagsJson;

    if (categoryId) {
      const patch = await fieldsFromCategoryId(
        categoryId,
        monthlyPeriodId,
        { budgetPlanId, taxCategory },
        exp.categoryId
          ? { forceBudgetLink: true }
          : { forceTaxDefault: true, forceBudgetLink: true },
      );
      categoryId = patch.categoryId;
      budgetPlanId = patch.budgetPlanId;
      taxCategory = patch.taxCategory;
    }

    const same =
      (tagsJson ?? null) === (exp.tagsJson ?? null) &&
      (budgetPlanId ?? null) === (exp.budgetPlanId ?? null) &&
      (taxCategory ?? null) === (exp.taxCategory ?? null) &&
      (categoryId ?? null) === (exp.categoryId ?? null) &&
      (finalized.payee ?? null) === (exp.payee ?? null);

    if (same) continue;

    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        tagsJson,
        payee: finalized.payee,
        categoryId,
        budgetPlanId,
        taxCategory,
      },
    });
    updated += 1;
    if (!exp.categoryId && categoryId) categoriesSet += 1;
  }

  return { scanned: expenses.length, updated, categoriesSet };
}
