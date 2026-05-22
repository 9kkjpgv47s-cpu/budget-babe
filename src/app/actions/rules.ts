"use server";

import { revalidatePath } from "next/cache";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { coerceCategoryId } from "@/lib/categories";
import { applyMerchantRulesToExistingExpenses } from "@/lib/merchantRules";
import type { FormActionState } from "@/lib/formActionState";

function revalidateMerchantRuleTargets(yearMonth: string) {
  revalidateLedgerPaths(yearMonth);
  revalidatePath("/import");
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
  revalidatePath("/import");
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
  revalidatePath("/import");
}

export async function deleteMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.merchantRule.delete({ where: { id } });
  revalidatePath("/import");
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
  const { updated, scanned, categoriesSet } =
    await applyMerchantRulesToExistingExpenses(period.id, yearMonth);
  revalidateMerchantRuleTargets(yearMonth);
  revalidatePath("/tax");
  if (updated === 0) {
    return {
      ok: true,
      message: `Scanned ${scanned} expense${scanned === 1 ? "" : "s"} — nothing to update.`,
    };
  }
  const parts: string[] = [`${updated} row${updated === 1 ? "" : "s"} updated`];
  if (categoriesSet > 0) {
    parts.push(
      `${categoriesSet} newly categorized`,
    );
  }
  return {
    ok: true,
    message: `${parts.join(" · ")} for ${yearMonth} (tags, payee, budget, categories).`,
  };
}
