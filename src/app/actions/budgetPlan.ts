"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

function rev(ym: string) {
  revalidatePath("/");
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
