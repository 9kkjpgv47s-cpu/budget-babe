import { prisma } from "@/lib/prisma";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";
import { suggestBudgetPlanId } from "./receiptBudgetSuggest";
import { buildReceiptExpenseMeta } from "./receiptExpenseMeta";

type ReceiptForPost = {
  id: string;
  ocrStatus: string;
  ocrRawText: string | null;
  ocrParsedLines: string | null;
  totalCents: number | null;
  filename: string;
};

export type PostReceiptResult =
  | { ok: true }
  | { ok: false; error: string; skip?: boolean };

export async function postReceiptTotalCore(params: {
  receipt: ReceiptForPost;
  userId: string;
  yearMonth: string;
}): Promise<PostReceiptResult> {
  const { receipt, userId, yearMonth } = params;
  if (receipt.ocrStatus !== "completed") {
    return { ok: false, error: "OCR not complete.", skip: true };
  }
  const dup = await prisma.expense.findFirst({ where: { receiptId: receipt.id } });
  if (dup) {
    return { ok: false, error: "Already posted.", skip: true };
  }
  const amountCents =
    receipt.totalCents != null && receipt.totalCents > 0
      ? receipt.totalCents
      : null;
  if (amountCents == null) {
    return { ok: false, error: "No total on receipt.", skip: true };
  }

  let parsed: ParsedReceiptLine[] = [];
  if (receipt.ocrParsedLines) {
    try {
      parsed = JSON.parse(receipt.ocrParsedLines) as ParsedReceiptLine[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }
  }

  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const plans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    select: { id: true, name: true, category: true },
  });
  const meta = buildReceiptExpenseMeta(receipt, parsed);
  const budgetPlanId = suggestBudgetPlanId(meta.description, plans);
  const tagsJson = await applyMerchantRulesToTags(meta.description, null);

  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId,
      amountCents,
      description: meta.description,
      payee: meta.payee,
      spentAt: meta.spentAt,
      source: "ocr",
      receiptId: receipt.id,
      budgetPlanId,
      tagsJson,
    },
  });
  return { ok: true };
}
