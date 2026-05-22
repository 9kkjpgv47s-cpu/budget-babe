"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
<<<<<<< HEAD
import {
  finalizeExpenseForWrite,
  getLastExpenseDefaultsForYearMonth,
} from "@/lib/entryDefaults";
=======
import { coerceCategoryId } from "@/lib/categories";
import { getLastExpenseDefaultsForYearMonth } from "@/lib/entryDefaults";
import { finalizeClassifiedExpenseWrite } from "@/lib/expenseWrite";
>>>>>>> 16f0210 (feat(agent-3): category helpers, expense filters, spend drill-down)
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
<<<<<<< HEAD
  let sharedCategoryId: string | null =
    categoryIdRaw || lastDefaults.categoryId;
  if (sharedCategoryId) {
    const cat = await prisma.category.findUnique({ where: { id: sharedCategoryId } });
    if (!cat) sharedCategoryId = null;
  }
=======
  const sharedCategoryId = await coerceCategoryId(categoryIdRaw);
>>>>>>> 16f0210 (feat(agent-3): category helpers, expense filters, spend drill-down)
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
  revalidateLedgerPaths(yearMonth);
  revalidatePath("/tax");
  return { ok: true, message: `Saved ${parsed.length} split lines (${splitGroupId.slice(0, 8)}…).` };
}
