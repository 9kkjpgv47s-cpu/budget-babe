"use server";

import { revalidatePath } from "next/cache";
import { addMonths, endOfDay, format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import {
  getOrCreateMonthlyPeriod,
  ensureHouseholdSettings,
} from "@/lib/dashboardData";
import { parseYearMonth } from "@/lib/yearMonth";
import type { FormActionState } from "@/lib/formActionState";
import { mergeTagLists } from "@/lib/budgetRollup";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";

async function periodFromYearMonth(yearMonth: string) {
  return getOrCreateMonthlyPeriod(yearMonth);
}

export async function updateIncomeCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const income = parseMoneyToCents(String(formData.get("income") ?? ""));
  if (!yearMonth || income == null) {
    return { error: "Invalid month or income." };
  }
  const period = await periodFromYearMonth(yearMonth);
  await prisma.monthlyPeriod.update({
    where: { id: period.id },
    data: { incomeCents: income },
  });
  revalidatePath("/");
  revalidatePath("/coach");
  return { ok: true };
}

export async function updateIncomeAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return updateIncomeCore(formData);
}

export async function updateNextPaycheckCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const raw = String(formData.get("nextPaycheck") ?? "").trim();
  await ensureHouseholdSettings();
  const nextPaycheckDate = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(nextPaycheckDate?.getTime() ?? NaN)) {
    return { error: "Invalid date." };
  }
  await prisma.householdSettings.update({
    where: { id: 1 },
    data: { nextPaycheckDate },
  });
  revalidatePath("/");
  revalidatePath("/coach");
  return { ok: true };
}

export async function updateNextPaycheckAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return updateNextPaycheckCore(formData);
}

export async function addExpenseCore(
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  if (!yearMonth || amount == null || !description) {
    return { error: "Month, amount, and description are required." };
  }
  const period = await periodFromYearMonth(yearMonth);
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();
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
  const manualTagsJson = tagsRaw.length ? mergeTagLists(tagsRaw) : null;
  const tagsJson = await applyMerchantRulesToTags(
    description,
    manualTagsJson,
  );
  const splitGroupId =
    String(formData.get("splitGroupId") ?? "").trim() || null;

  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      amountCents: amount,
      description,
      budgetPlanId,
      tagsJson,
      splitGroupId,
      source: "manual",
    },
  });
  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/flow");
  return { ok: true };
}

export async function addExpenseAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addExpenseCore(formData);
}

export async function addBillCore(formData: FormData): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  if (!yearMonth || !title || amount == null || !dueRaw) {
    return { error: "Fill all bill fields." };
  }
  const dueDate = new Date(dueRaw);
  if (Number.isNaN(dueDate.getTime())) {
    return { error: "Invalid due date." };
  }
  const period = await periodFromYearMonth(yearMonth);
  await prisma.bill.create({
    data: {
      monthlyPeriodId: period.id,
      title,
      amountCents: amount,
      dueDate,
    },
  });
  revalidateBills();
  return { ok: true };
}

export async function addBillAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addBillCore(formData);
}

export async function toggleBillPaidAction(formData: FormData): Promise<void> {
  await requireUser();
  const billId = String(formData.get("billId") ?? "");
  const paid = String(formData.get("paid") ?? "") === "true";
  if (!billId) return;
  await prisma.bill.update({
    where: { id: billId },
    data: { paid },
  });
  revalidateBills();
}

function revalidateBills() {
  revalidatePath("/");
  revalidatePath("/bills");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
}

export async function updateBillAction(formData: FormData): Promise<void> {
  await requireUser();
  const billId = String(formData.get("billId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const paid = String(formData.get("paid") ?? "") === "on";
  if (!billId || !yearMonth || !title || amount == null || !dueRaw) return;
  const dueDate = new Date(dueRaw);
  if (Number.isNaN(dueDate.getTime())) return;
  const period = await periodFromYearMonth(yearMonth);
  const bill = await prisma.bill.findFirst({
    where: { id: billId, monthlyPeriodId: period.id },
  });
  if (!bill) return;
  await prisma.bill.update({
    where: { id: billId },
    data: { title, amountCents: amount, dueDate, paid },
  });
  revalidateBills();
}

export async function deleteBillAction(formData: FormData): Promise<void> {
  await requireUser();
  const billId = String(formData.get("billId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!billId || !yearMonth) return;
  const period = await periodFromYearMonth(yearMonth);
  await prisma.bill.deleteMany({
    where: { id: billId, monthlyPeriodId: period.id },
  });
  revalidateBills();
}

/** Clone last month’s bills into this month with due dates shifted +1 calendar month. */
export async function copyBillsFromPreviousMonthAction(
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
  const prevBills = await prisma.bill.findMany({
    where: { monthlyPeriodId: prevPeriod.id },
  });
  for (const b of prevBills) {
    const newDue = addMonths(b.dueDate, 1);
    const dup = await prisma.bill.findFirst({
      where: {
        monthlyPeriodId: curPeriod.id,
        title: b.title,
        amountCents: b.amountCents,
        dueDate: {
          gte: startOfDay(newDue),
          lte: endOfDay(newDue),
        },
      },
    });
    if (dup) continue;
    await prisma.bill.create({
      data: {
        monthlyPeriodId: curPeriod.id,
        title: b.title,
        amountCents: b.amountCents,
        dueDate: newDue,
        paid: false,
      },
    });
  }
  revalidateBills();
}

export async function addBudgetPlanCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const limit = parseMoneyToCents(String(formData.get("limit") ?? ""));
  const rolledIn =
    parseMoneyToCents(String(formData.get("rolledIn") ?? "0")) ?? 0;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!yearMonth || !name || limit == null) {
    return { error: "Name and limit are required." };
  }
  const period = await periodFromYearMonth(yearMonth);
  await prisma.budgetPlan.create({
    data: {
      monthlyPeriodId: period.id,
      name,
      category,
      limitCents: limit,
      rolledInCents: rolledIn,
      note,
    },
  });
  revalidatePath("/");
  revalidatePath("/bills");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
  return { ok: true };
}

export async function addBudgetPlanAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addBudgetPlanCore(formData);
}
