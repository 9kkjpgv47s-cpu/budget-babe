import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateReceiptPostSafety } from "@/app/(app)/receipts/receiptPostSafety";

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

  const safety = await evaluateReceiptPostSafety({
    ocrStatus: receipt.ocrStatus,
    expenseCount: receipt._count.expenses,
    totalCents: receipt.totalCents,
    ocrConfidence: receipt.ocrConfidence,
    monthlyPeriodId: receipt.monthlyPeriodId,
  });

  return NextResponse.json({
    id: receipt.id,
    ocrStatus: receipt.ocrStatus,
    totalCents: receipt.totalCents,
    ocrConfidence: receipt.ocrConfidence,
    expenseCount: receipt._count.expenses,
    readyToPost: safety.readyToPost,
    autoPostSafe: safety.autoPostSafe,
    autoPostBlockedReason: safety.autoPostBlockedReason,
    warnings: safety.warnings,
  });
}
