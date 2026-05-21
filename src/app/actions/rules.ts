"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { applyMerchantRulesToExistingExpenses } from "@/lib/merchantRules";
import type { FormActionState } from "@/lib/formActionState";

function revalidateMerchantRuleTargets(yearMonth: string) {
  revalidatePath("/import");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
  revalidatePath("/insights");
  revalidatePath(`/`);
  revalidatePath(`/?ym=${yearMonth}`);
}

export async function addMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const pattern = String(formData.get("pattern") ?? "").trim().toLowerCase();
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!pattern || !tag) return;
  await prisma.merchantRule.create({
    data: { pattern, tag, sortOrder: 0 },
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
  const { updated, scanned } = await applyMerchantRulesToExistingExpenses(
    period.id,
  );
  revalidateMerchantRuleTargets(yearMonth);
  return {
    ok: true,
    message:
      updated === 0
        ? `Scanned ${scanned} expense${scanned === 1 ? "" : "s"} — no tag changes needed.`
        : `Updated tags on ${updated} of ${scanned} expense${scanned === 1 ? "" : "s"} for ${yearMonth}.`,
  };
}
