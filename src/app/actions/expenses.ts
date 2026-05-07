"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { mergeTagLists } from "@/lib/budgetRollup";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

function revalidateAll(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/import");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const spentRaw = String(formData.get("spentAt") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  if (!id || !yearMonth || amount == null || !description) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const exp = await prisma.expense.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!exp) return;

  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }
  const tagsRaw = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const manual = tagsRaw.length ? mergeTagLists(tagsRaw) : null;
  const tagsJson = await applyMerchantRulesToTags(description, manual);
  const spentAt = spentRaw ? new Date(spentRaw) : exp.spentAt;
  if (Number.isNaN(spentAt.getTime())) return;

  await prisma.expense.update({
    where: { id },
    data: {
      amountCents: amount,
      description,
      spentAt,
      budgetPlanId,
      tagsJson,
    },
  });
  revalidateAll(yearMonth);
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!id || !yearMonth) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  await prisma.expense.deleteMany({
    where: { id, monthlyPeriodId: period.id },
  });
  revalidateAll(yearMonth);
}
