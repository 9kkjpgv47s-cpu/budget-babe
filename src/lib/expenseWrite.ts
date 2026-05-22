/**
 * Expense write pipeline — delegates to Agent 1 `finalizeExpenseForWrite` in entryDefaults.
 */
import {
  finalizeExpenseForWrite,
  type FinalizeExpenseInput,
  type MerchantRuleDraft,
} from "@/lib/entryDefaults";
import { prisma } from "@/lib/prisma";
import { fieldsFromCategoryId, type CategoryFieldPatch } from "@/lib/categories";
import { classifyExpenseForWrite } from "@/lib/merchantRules";

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
  _expenses: ExpenseRow[],
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

export type ClassifyUncategorizedResult = {
  scanned: number;
  categorized: number;
};

/** Auto-classify expenses in a month that have no category yet. */
export async function classifyUncategorizedForPeriod(
  monthlyPeriodId: string,
): Promise<ClassifyUncategorizedResult> {
  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId, categoryId: null },
    select: {
      id: true,
      description: true,
      tagsJson: true,
      budgetPlanId: true,
      taxCategory: true,
    },
  });

  let categorized = 0;
  for (const exp of expenses) {
    const classified = await classifyExpenseForWrite(exp.description, monthlyPeriodId, {
      tagsJson: exp.tagsJson,
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    });
    if (!classified.categoryId) continue;

    const patch = await fieldsFromCategoryId(
      classified.categoryId,
      monthlyPeriodId,
      {
        budgetPlanId: classified.budgetPlanId,
        taxCategory: classified.taxCategory,
      },
      { forceTaxDefault: true, forceBudgetLink: true },
    );

    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        categoryId: patch.categoryId,
        budgetPlanId: patch.budgetPlanId,
        taxCategory: patch.taxCategory,
        tagsJson: classified.tagsJson,
      },
    });
    categorized += 1;
  }

  return { scanned: expenses.length, categorized };
}

/** Assign or clear category on one expense (bulk row editor). */
export async function assignCategoryToExpense(
  expenseId: string,
  monthlyPeriodId: string,
  categoryId: string | null,
  opts?: { applyTaxFromCategory?: boolean },
): Promise<void> {
  const exp = await prisma.expense.findFirst({
    where: { id: expenseId, monthlyPeriodId },
    select: {
      id: true,
      description: true,
      tagsJson: true,
      budgetPlanId: true,
      taxCategory: true,
    },
  });
  if (!exp) return;

  const patch = await fieldsFromCategoryId(
    categoryId,
    monthlyPeriodId,
    {
      budgetPlanId: exp.budgetPlanId,
      taxCategory: exp.taxCategory,
    },
    categoryId
      ? {
          forceTaxDefault: opts?.applyTaxFromCategory ?? true,
          forceBudgetLink: true,
        }
      : undefined,
  );

  let tagsJson = exp.tagsJson;
  if (categoryId) {
    const classified = await classifyExpenseForWrite(exp.description, monthlyPeriodId, {
      categoryId,
      tagsJson: exp.tagsJson,
      autoSuggest: false,
    });
    tagsJson = classified.tagsJson;
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      categoryId: patch.categoryId,
      budgetPlanId: patch.budgetPlanId,
      taxCategory: patch.taxCategory,
      tagsJson,
    },
  });
}
