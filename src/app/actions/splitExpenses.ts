"use server";

import { randomUUID } from "crypto";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { coerceCategoryId } from "@/lib/categories";
import {
  finalizeExpenseForWrite,
  getLastExpenseDefaultsForYearMonth,
} from "@/lib/entryDefaults";
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
  const lastDefaults = await getLastExpenseDefaultsForYearMonth(yearMonth);
  let sharedBudgetId: string | null =
    budgetPlanIdRaw || lastDefaults.budgetPlanId;
  const sharedCategoryId = await coerceCategoryId(
    categoryIdRaw || lastDefaults.categoryId,
  );
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
    const fields = await finalizeExpenseForWrite(
      {
        description: p.description,
        tagsJson: lastDefaults.tagsJson,
        budgetPlanId: sharedBudgetId,
        payee: lastDefaults.payee,
        categoryId: sharedCategoryId,
        autoSuggestCategory: !sharedCategoryId,
      },
      yearMonth,
    );
    sharedBudgetId = fields.budgetPlanId;
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId: user.userId,
        amountCents: p.amountCents,
        description: p.description,
        spentAt: new Date(),
        splitGroupId,
        payee: fields.payee,
        categoryId: fields.categoryId,
        budgetPlanId: fields.budgetPlanId,
        taxCategory: fields.taxCategory,
        tagsJson: fields.tagsJson,
        source: "manual",
      },
    });
  }
  revalidateLedgerPaths(yearMonth, [
    "overview",
    "expenses",
    "bills",
    "budgets",
    "insights",
    "flow",
    "coach",
    "tax",
  ]);
  return { ok: true, message: `Saved ${parsed.length} split lines (${splitGroupId.slice(0, 8)}…).` };
}
