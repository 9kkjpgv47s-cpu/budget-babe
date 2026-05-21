"use server";

import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { coerceCategoryId } from "@/lib/categories";
import { currentYearMonth } from "@/lib/yearMonth";
import { applyMerchantRulesToExistingExpenses } from "@/lib/merchantRules";
import type { FormActionState } from "@/lib/formActionState";

function revalidateMerchantRuleTargets(yearMonth: string) {
  revalidateLedgerPaths(yearMonth, [
    "import",
    "expenses",
    "budgets",
    "insights",
    "overview",
    "tax",
  ]);
}

export async function addMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const pattern = String(formData.get("pattern") ?? "").trim().toLowerCase();
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!pattern || !tag) return;
  const categoryId = await coerceCategoryId(categoryIdRaw);
  await prisma.merchantRule.create({
    data: { pattern, tag, categoryId, sortOrder: 0 },
  });
  revalidateLedgerPaths(currentYearMonth(), ["import"]);
}

export async function updateMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const pattern = String(formData.get("pattern") ?? "").trim().toLowerCase();
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
  if (!id || !pattern || !tag) return;
  const categoryId = await coerceCategoryId(categoryIdRaw);
  await prisma.merchantRule.update({
    where: { id },
    data: { pattern, tag, categoryId },
  });
  revalidateLedgerPaths(currentYearMonth(), ["import"]);
}

export async function deleteMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.merchantRule.delete({ where: { id } });
  revalidateLedgerPaths(currentYearMonth(), ["import"]);
}

export async function applyMerchantRulesToMonthAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
    return { error: "Invalid month." };
  }
  const rules = await prisma.merchantRule.count();
  if (rules === 0) {
    return { error: "Add at least one merchant rule first." };
  }

  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const result = await applyMerchantRulesToExistingExpenses(
    period.id,
    yearMonth,
  );
  revalidateMerchantRuleTargets(yearMonth);
  const { updated, scanned, tagsChanged, budgetLinked, payeeSet, categorySet } =
    result;
  if (updated === 0) {
    return {
      ok: true,
      message: `Scanned ${scanned} expense${scanned === 1 ? "" : "s"} — nothing to update.`,
    };
  }
  const parts: string[] = [`${updated} row${updated === 1 ? "" : "s"} updated`];
  if (tagsChanged > 0) {
    parts.push(`${tagsChanged} tag${tagsChanged === 1 ? "" : "s"}`);
  }
  if (budgetLinked > 0) {
    parts.push(`${budgetLinked} budget link${budgetLinked === 1 ? "" : "s"}`);
  }
  if (categorySet > 0) {
    parts.push(`${categorySet} categor${categorySet === 1 ? "y" : "ies"}`);
  }
  if (payeeSet > 0) {
    parts.push(`${payeeSet} payee${payeeSet === 1 ? "" : "s"}`);
  }
  return {
    ok: true,
    message: `${parts.join(" · ")} for ${yearMonth}.`,
  };
}
