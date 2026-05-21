"use server";

import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";
import {
  commaListToTagsJson,
  finalizeExpenseDraftForPeriod,
  getBudgetPlansForYearMonth,
} from "@/lib/entryDefaults";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

function revalidateAll(yearMonth: string) {
  revalidateLedgerPaths(yearMonth);
}

function parseExpenseIds(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function bulkApplyTagsToExpensesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const ids = parseExpenseIds(String(formData.get("expenseIds") ?? ""));
  const tagsRaw = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const tagMode = String(formData.get("tagMode") ?? "append");
  if (!yearMonth || ids.length === 0 || tagsRaw.length === 0) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    const manual =
      tagMode === "replace"
        ? mergeTagLists(tagsRaw)
        : mergeTagLists(parseTagsJson(exp.tagsJson), tagsRaw);
    const tagsJson = await applyMerchantRulesToTags(exp.description, manual ?? exp.tagsJson);
    await prisma.expense.update({ where: { id }, data: { tagsJson } });
  }
  revalidateAll(yearMonth);
}

export async function bulkSetBudgetForExpensesAction(formData: FormData): Promise<void> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const ids = parseExpenseIds(String(formData.get("expenseIds") ?? ""));
  const raw = String(formData.get("bulkBudgetPlanId") ?? "").trim();
  if (!yearMonth || ids.length === 0 || !raw) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  let budgetPlanId: string | null = null;
  if (raw === "none") {
    budgetPlanId = null;
  } else {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: raw, monthlyPeriodId: period.id },
    });
    if (!plan) return;
    budgetPlanId = plan.id;
  }
  for (const id of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id, monthlyPeriodId: period.id },
    });
    if (!exp) continue;
    await prisma.expense.update({ where: { id }, data: { budgetPlanId } });
  }
  revalidateAll(yearMonth);
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const spentRaw = String(formData.get("spentAt") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
  const payee = String(formData.get("payee") ?? "").trim() || null;
  if (!id || !yearMonth || amount == null || !description) return;
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const exp = await prisma.expense.findFirst({
    where: { id, monthlyPeriodId: period.id },
  });
  if (!exp) return;

  const plans = await getBudgetPlansForYearMonth(yearMonth);
  const draft = await finalizeExpenseDraftForPeriod(
    {
      description,
      tagsJson: commaListToTagsJson(String(formData.get("tags") ?? "")),
      budgetPlanId: budgetPlanIdRaw || null,
      payee,
    },
    period.id,
    plans,
  );
  const spentAt = spentRaw ? new Date(spentRaw) : exp.spentAt;
  if (Number.isNaN(spentAt.getTime())) return;

  await prisma.expense.update({
    where: { id },
    data: {
      amountCents: amount,
      description,
      spentAt,
      budgetPlanId: draft.budgetPlanId,
      tagsJson: draft.tagsJson,
      payee: draft.payee,
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
