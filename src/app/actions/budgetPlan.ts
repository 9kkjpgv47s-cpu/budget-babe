"use server";

import { addMonths, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { parseYearMonth } from "@/lib/yearMonth";
import { applySuggestedRolloversForYearMonth } from "@/app/actions/rollover";

function rev(ym: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/insights");
  revalidatePath("/coach");
  revalidatePath("/flow");
  revalidatePath("/import");
  revalidatePath(`/expenses?ym=${ym}`);
  revalidatePath("/net-worth");
}

export async function updateBudgetPlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const limit = parseMoneyToCents(String(formData.get("limit") ?? ""));
  const rolledInRaw = parseMoneyToCents(String(formData.get("rolledIn") ?? ""));
  const rolledIn = rolledInRaw ?? 0;
  const category = String(formData.get("category") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id || !yearMonth || !name || limit == null) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const existing = await prisma.budgetPlan.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!existing) return;
  await prisma.budgetPlan.update({
    where: { id },
    data: {
      name,
      limitCents: limit,
      rolledInCents: rolledIn,
      category,
      note,
    },
  });
  rev(yearMonth);
}

export async function deleteBudgetPlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!id || !yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const existing = await prisma.budgetPlan.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!existing) return;
  await prisma.budgetPlan.delete({ where: { id } });
  rev(yearMonth);
}

/** Clone prior month’s budget lines (same name/category/limit/note); rolled-in = 0. */
export async function copyBudgetPlansFromPreviousMonthAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth.match(/^\d{4}-\d{2}$/)) return;
  const prevYm = format(addMonths(parseYearMonth(yearMonth), -1), "yyyy-MM");
  const [curPeriod, prevPeriod] = await Promise.all([
    getOrCreateMonthlyPeriod(yearMonth),
    prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } }),
  ]);
  if (!prevPeriod) return;
  const prevPlans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: prevPeriod.id },
    orderBy: { name: "asc" },
  });
  for (const p of prevPlans) {
    const dup = await prisma.budgetPlan.findFirst({
      where: { monthlyPeriodId: curPeriod.id, name: p.name },
    });
    if (dup) continue;
    await prisma.budgetPlan.create({
      data: {
        monthlyPeriodId: curPeriod.id,
        name: p.name,
        category: p.category,
        limitCents: p.limitCents,
        rolledInCents: 0,
        note: p.note,
      },
    });
  }
  const withRollover = formData.get("withRollover") === "on";
  if (withRollover) {
    await applySuggestedRolloversForYearMonth(yearMonth);
  } else {
    rev(yearMonth);
  }
}
