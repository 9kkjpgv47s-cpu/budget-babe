import { prisma } from "@/lib/prisma";

export const MAX_AUTO_POST_CENTS = 500_000;
export const MIN_OCR_CONFIDENCE = 35;

export type AutoPostBlockReason =
  | "not_ready"
  | "low_confidence"
  | "amount_too_large"
  | "duplicate_amount"
  | null;

export function ocrConfidenceOk(ocrConfidence: number | null): boolean {
  return ocrConfidence == null || ocrConfidence >= MIN_OCR_CONFIDENCE;
}

export async function hasDuplicateAmountRecently(
  monthlyPeriodId: string,
  amountCents: number,
): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const similar = await prisma.expense.findFirst({
    where: {
      monthlyPeriodId,
      amountCents,
      spentAt: { gte: since },
    },
    select: { id: true },
  });
  return similar != null;
}

export async function evaluateReceiptPostSafety(params: {
  ocrStatus: string;
  expenseCount: number;
  totalCents: number | null;
  ocrConfidence: number | null;
  monthlyPeriodId: string | null;
}): Promise<{
  readyToPost: boolean;
  autoPostSafe: boolean;
  autoPostBlockedReason: AutoPostBlockReason;
  warnings: string[];
}> {
  const readyToPost =
    params.ocrStatus === "completed" &&
    params.expenseCount === 0 &&
    params.totalCents != null &&
    params.totalCents > 0;

  if (!readyToPost) {
    return {
      readyToPost: false,
      autoPostSafe: false,
      autoPostBlockedReason: "not_ready",
      warnings: [],
    };
  }

  const total = params.totalCents!;
  const warnings: string[] = [];

  if (!ocrConfidenceOk(params.ocrConfidence)) {
    warnings.push(
      `OCR confidence is below ${MIN_OCR_CONFIDENCE}% — review the scan before posting.`,
    );
  }
  if (total > MAX_AUTO_POST_CENTS) {
    warnings.push("Total is over $5,000 — confirm this is correct before posting.");
  }

  let duplicate = false;
  if (params.monthlyPeriodId) {
    duplicate = await hasDuplicateAmountRecently(params.monthlyPeriodId, total);
    if (duplicate) {
      warnings.push(
        "An expense with this same amount was posted in the last 7 days.",
      );
    }
  }

  let autoPostBlockedReason: AutoPostBlockReason = null;
  if (!ocrConfidenceOk(params.ocrConfidence)) {
    autoPostBlockedReason = "low_confidence";
  } else if (total > MAX_AUTO_POST_CENTS) {
    autoPostBlockedReason = "amount_too_large";
  } else if (duplicate) {
    autoPostBlockedReason = "duplicate_amount";
  }

  return {
    readyToPost: true,
    autoPostSafe: autoPostBlockedReason === null,
    autoPostBlockedReason,
    warnings,
  };
}
