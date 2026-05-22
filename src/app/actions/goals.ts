"use server";

import { prisma } from "@/lib/prisma";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { currentYearMonth } from "@/lib/yearMonth";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import type { FormActionState } from "@/lib/formActionState";

export async function addSavingsGoalCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const target = parseMoneyToCents(String(formData.get("target") ?? ""));
  const saved = parseMoneyToCents(String(formData.get("saved") ?? "0")) ?? 0;
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (!title || target == null) {
    return { error: "Title and target amount required." };
  }
  await prisma.savingsGoal.create({
    data: {
      title,
      targetAmountCents: target,
      savedAmountCents: saved,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    },
  });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
  return { ok: true };
}

export async function addSavingsGoalAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addSavingsGoalCore(formData);
}

export async function updateGoalSavedCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const id = String(formData.get("goalId") ?? "");
  const saved = parseMoneyToCents(String(formData.get("saved") ?? ""));
  if (!id || saved == null) return { error: "Invalid." };
  await prisma.savingsGoal.update({
    where: { id },
    data: { savedAmountCents: saved },
  });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
  return { ok: true };
}

export async function updateGoalSavedAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return updateGoalSavedCore(formData);
}

export async function addSpendingAdjustmentCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const goalId = String(formData.get("goalId") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") ?? ""));
  if (!label || amount == null) {
    return { error: "Label and amount required." };
  }
  await prisma.spendingAdjustment.create({
    data: {
      savingsGoalId: goalId,
      label,
      amountCents: amount,
    },
  });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
  return { ok: true };
}

export async function addSpendingAdjustmentAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return addSpendingAdjustmentCore(formData);
}

export async function updateSavingsGoalAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const id = String(formData.get("goalId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const target = parseMoneyToCents(String(formData.get("target") ?? ""));
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (!id || !title || target == null) {
    return { error: "Title and target are required." };
  }
  await prisma.savingsGoal.update({
    where: { id },
    data: {
      title,
      targetAmountCents: target,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    },
  });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
  return { ok: true };
}

export async function deleteSpendingAdjustmentAction(
  formData: FormData,
): Promise<void> {
  await requireUser();
  const id = String(formData.get("adjustmentId") ?? "");
  if (!id) return;
  await prisma.spendingAdjustment.deleteMany({ where: { id } });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("goalId") ?? "");
  if (!id) return;
  await prisma.savingsGoal.delete({ where: { id } });
  revalidateLedgerPaths(currentYearMonth(), ["goals", "overview"]);
}
