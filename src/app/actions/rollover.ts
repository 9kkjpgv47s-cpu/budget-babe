"use server";

import { revalidatePath } from "next/cache";
import { addMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  spentForBudgetPlan,
  type BudgetPlanForRollup,
  type ExpenseForRollup,
} from "@/lib/budgetRollup";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { parseYearMonth } from "@/lib/yearMonth";

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function revalidateAfterRollover(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/insights");
  revalidatePath("/coach");
  revalidatePath("/flow");
  revalidatePath("/import");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/net-worth");
}

/**
 * For each budget line in `yearMonth`, set rolledInCents from the previous
 * month’s unused envelope for the same name (when a matching prior line exists).
 */
export async function applySuggestedRolloversForYearMonth(
  yearMonth: string,
): Promise<void> {
  if (!yearMonth.match(/^\d{4}-\d{2}$/)) return;
  await requireUser();
  const prevYm = format(addMonths(parseYearMonth(yearMonth), -1), "yyyy-MM");
  const [curPeriod, prevPeriod] = await Promise.all([
    getOrCreateMonthlyPeriod(yearMonth),
    prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } }),
  ]);
  if (!prevPeriod) return;

  const [curPlans, prevPlans, prevExpenses] = await Promise.all([
    prisma.budgetPlan.findMany({ where: { monthlyPeriodId: curPeriod.id } }),
    prisma.budgetPlan.findMany({ where: { monthlyPeriodId: prevPeriod.id } }),
    prisma.expense.findMany({ where: { monthlyPeriodId: prevPeriod.id } }),
  ]);

  const prevExpRoll: ExpenseForRollup[] = prevExpenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    budgetPlanId: e.budgetPlanId,
    tagsJson: e.tagsJson,
  }));

  for (const cp of curPlans) {
    const match = prevPlans.find((p) => normName(p.name) === normName(cp.name));
    if (!match) continue;
    const planR: BudgetPlanForRollup = {
      id: match.id,
      name: match.name,
      category: match.category,
      limitCents: match.limitCents,
      rolledInCents: match.rolledInCents,
    };
    const spent = spentForBudgetPlan(planR, prevExpRoll);
    const unused = match.rolledInCents + match.limitCents - spent;
    const rolled = Math.max(0, unused);
    await prisma.budgetPlan.update({
      where: { id: cp.id },
      data: { rolledInCents: rolled },
    });
  }

  revalidateAfterRollover(yearMonth);
}

export async function applySuggestedRolloversAction(formData: FormData): Promise<void> {
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  await applySuggestedRolloversForYearMonth(yearMonth);
}
