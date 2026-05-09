"use server";

import path from "path";
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
import { guessPaystubAmountFromBuffer } from "@/lib/paystubOcr";
import { deletePaystubStored, savePaystubUpload } from "@/lib/uploads";

async function periodFromYearMonth(yearMonth: string) {
  return getOrCreateMonthlyPeriod(yearMonth);
}

export async function addPaycheckCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const receivedRaw = String(formData.get("receivedOn") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const amountTyped = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const file = formData.get("paystubFile");

  if (!yearMonth) {
    return { error: "Missing month." };
  }

  const receivedOn = receivedRaw ? new Date(receivedRaw) : new Date();
  if (Number.isNaN(receivedOn.getTime())) {
    return { error: "Invalid paycheck date." };
  }

  let amountCents = amountTyped;
  let imageFilename: string | null = null;

  try {
    let stubBytes: Buffer | null = null;
    let stubHintName = "paystub.jpg";

    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) {
        return { error: "Pay stub file must be 8MB or smaller." };
      }
      stubBytes = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || ".bin";
      const safeBase = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .slice(0, 40);
      stubHintName = `${safeBase || "paystub"}${ext}`;

      if (amountCents == null) {
        amountCents = await guessPaystubAmountFromBuffer(
          stubBytes,
          stubHintName,
        );
      }
    }

    if (amountCents == null) {
      return {
        error:
          "Enter the take-home amount, or upload a clear photo/PDF of your pay stub so we can read it.",
      };
    }

    if (stubBytes) {
      imageFilename = await savePaystubUpload({
        buffer: stubBytes,
        basename: file instanceof File ? file.name : stubHintName,
      });
    }

    const period = await periodFromYearMonth(yearMonth);
    await prisma.paycheck.create({
      data: {
        monthlyPeriodId: period.id,
        amountCents,
        receivedOn,
        note,
        imageFilename,
      },
    });
    revalidatePath("/");
    revalidatePath("/coach");
    revalidatePath("/flow");
    revalidatePath("/insights");
    return { ok: true };
  } catch (e) {
    if (imageFilename) {
      await deletePaystubStored(imageFilename);
    }
    const message = e instanceof Error ? e.message : String(e);
    return { error: message.slice(0, 500) };
  }
}

export async function addPaycheckAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addPaycheckCore(formData);
}

export async function deletePaycheckAction(formData: FormData): Promise<void> {
  await requireUser();
  const paycheckId = String(formData.get("paycheckId") ?? "");
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!paycheckId || !yearMonth) return;
  const period = await periodFromYearMonth(yearMonth);
  const row = await prisma.paycheck.findFirst({
    where: { id: paycheckId, monthlyPeriodId: period.id },
  });
  if (!row) return;
  await prisma.paycheck.deleteMany({
    where: { id: paycheckId, monthlyPeriodId: period.id },
  });
  if (row.imageFilename) {
    await deletePaystubStored(row.imageFilename);
  }
  revalidatePath("/");
  revalidatePath("/coach");
  revalidatePath("/flow");
  revalidatePath("/insights");
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

export async function updateMonthlyNotesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!yearMonth) return { error: "Missing month." };
  const period = await periodFromYearMonth(yearMonth);
  await prisma.monthlyPeriod.update({
    where: { id: period.id },
    data: { notes },
  });
  revalidatePath("/");
  return { ok: true };
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
  revalidatePath("/budgets");
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
  revalidatePath("/budgets");
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
  revalidatePath("/budgets");
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

const ENTRY_KINDS = new Set([
  "expense",
  "bill",
  "budget_line",
  "paycheck",
]);

/** Single quick-add entry point: branch by `entryKind` in form data. */
export async function unifiedQuickEntryAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const kind = String(formData.get("entryKind") ?? "").trim();
  if (!ENTRY_KINDS.has(kind)) {
    return { error: "Pick an entry type." };
  }
  switch (kind) {
    case "expense":
      return addExpenseCore(formData);
    case "bill":
      return addBillCore(formData);
    case "budget_line":
      return addBudgetPlanCore(formData);
    case "paycheck":
      return addPaycheckCore(formData);
    default:
      return { error: "Pick an entry type." };
  }
}
