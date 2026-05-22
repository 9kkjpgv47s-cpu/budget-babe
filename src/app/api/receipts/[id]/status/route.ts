import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      ocrStatus: true,
      totalCents: true,
      ocrConfidence: true,
      monthlyPeriodId: true,
      _count: { select: { expenses: true } },
    },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const readyToPost =
    receipt.ocrStatus === "completed" &&
    receipt._count.expenses === 0 &&
    receipt.totalCents != null &&
    receipt.totalCents > 0;

  const maxAutoPostCents = 500_000;
  const minConfidence = 35;
  const confidenceOk =
    receipt.ocrConfidence == null || receipt.ocrConfidence >= minConfidence;

  let duplicateAmountRecently = false;
  const periodId = receipt.monthlyPeriodId;
  if (readyToPost && receipt.totalCents != null && periodId) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const similar = await prisma.expense.findFirst({
      where: {
        monthlyPeriodId: periodId,
        amountCents: receipt.totalCents,
        spentAt: { gte: since },
      },
      select: { id: true },
    });
    duplicateAmountRecently = similar != null;
  }

  const autoPostSafe =
    readyToPost &&
    confidenceOk &&
    receipt.totalCents! <= maxAutoPostCents &&
    !duplicateAmountRecently;

  return NextResponse.json({
    id: receipt.id,
    ocrStatus: receipt.ocrStatus,
    totalCents: receipt.totalCents,
    ocrConfidence: receipt.ocrConfidence,
    expenseCount: receipt._count.expenses,
    readyToPost,
    autoPostSafe,
    autoPostBlockedReason: autoPostSafe
      ? null
      : !readyToPost
        ? "not_ready"
        : !confidenceOk
          ? "low_confidence"
          : receipt.totalCents! > maxAutoPostCents
            ? "amount_too_large"
            : duplicateAmountRecently
              ? "duplicate_amount"
              : "unknown",
  });
}
