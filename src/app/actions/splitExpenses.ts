"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
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
  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
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
    const tagsJson = await applyMerchantRulesToTags(p.description, null);
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId: user.userId,
        amountCents: p.amountCents,
        description: p.description,
        spentAt: new Date(),
        splitGroupId,
        budgetPlanId,
        tagsJson,
        source: "manual",
      },
    });
  }
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/insights");
  revalidatePath("/import");
  revalidatePath("/flow");
  revalidatePath("/coach");
  return { ok: true, message: `Saved ${parsed.length} split lines (${splitGroupId.slice(0, 8)}…).` };
}
