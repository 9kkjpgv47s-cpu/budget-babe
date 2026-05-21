"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import {
  finalizeExpenseDraftForPeriod,
  getBudgetPlansForYearMonth,
  getLastExpenseDefaultsForYearMonth,
} from "@/lib/entryDefaults";
import { fieldsFromCategoryId } from "@/lib/categories";
import { classifyExpenseForWrite } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";

type Line = { amount: string; description: string };

export async function createSplitExpensesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const linesRaw = String(formData.get("linesJson") ?? "");
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!yearMonth || !linesRaw.trim()) {
    return { error: "Month and split lines are required." };
  }
  let lines: Line[];
  try {
    lines = JSON.parse(linesRaw) as Line[];
  } catch {
    return { error: "Invalid lines JSON." };
  }
  if (!Array.isArray(lines) || lines.length < 2) {
    return { error: "Add at least two split lines." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const [plans, lastDefaults] = await Promise.all([
    getBudgetPlansForYearMonth(yearMonth),
    getLastExpenseDefaultsForYearMonth(yearMonth),
  ]);
  let sharedBudgetId: string | null =
    budgetPlanIdRaw || lastDefaults.budgetPlanId;
  let sharedCategoryId: string | null = categoryIdRaw || null;
  if (sharedCategoryId) {
    const cat = await prisma.category.findUnique({ where: { id: sharedCategoryId } });
    if (!cat) sharedCategoryId = null;
  }
  const splitGroupId = randomUUID();
  let sum = 0;
  const parsed: { amountCents: number; description: string }[] = [];
  for (const ln of lines) {
    const amt = parseMoneyToCents(ln.amount);
    const desc = String(ln.description ?? "").trim();
    if (amt == null || !desc) {
      return { error: "Each line needs amount and description." };
    }
    sum += amt;
    parsed.push({ amountCents: amt, description: desc });
  }
  if (sum <= 0) {
    return { error: "Total must be positive." };
  }
  for (const p of parsed) {
    const draft = await finalizeExpenseDraftForPeriod(
      {
        description: p.description,
        tagsJson: lastDefaults.tagsJson,
        budgetPlanId: sharedBudgetId,
        payee: lastDefaults.payee,
      },
      period.id,
      plans,
    );
    const classified = await classifyExpenseForWrite(p.description, period.id, {
      categoryId: sharedCategoryId,
      tagsJson: draft.tagsJson,
      budgetPlanId: draft.budgetPlanId,
    });
    let finalBudget = classified.budgetPlanId ?? draft.budgetPlanId;
    let finalTax = classified.taxCategory;
    if (classified.categoryId) {
      const patch = await fieldsFromCategoryId(
        classified.categoryId,
        period.id,
        {
          budgetPlanId: finalBudget,
          taxCategory: finalTax,
        },
        { forceTaxDefault: true, forceBudgetLink: true },
      );
      finalBudget = patch.budgetPlanId;
      finalTax = patch.taxCategory;
    }
    sharedBudgetId = finalBudget;
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId: user.userId,
        amountCents: p.amountCents,
        description: p.description,
        spentAt: new Date(),
        splitGroupId,
        payee: draft.payee,
        categoryId: classified.categoryId,
        budgetPlanId: finalBudget,
        taxCategory: finalTax,
        tagsJson: classified.tagsJson,
        source: "manual",
      },
    });
  }
  revalidateLedgerPaths(yearMonth);
  revalidatePath("/tax");
  return { ok: true, message: `Saved ${parsed.length} split lines (${splitGroupId.slice(0, 8)}…).` };
}
