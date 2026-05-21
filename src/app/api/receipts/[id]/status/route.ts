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
      _count: { select: { expenses: true } },
    },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: receipt.id,
    ocrStatus: receipt.ocrStatus,
    totalCents: receipt.totalCents,
    ocrConfidence: receipt.ocrConfidence,
    expenseCount: receipt._count.expenses,
    readyToPost:
      receipt.ocrStatus === "completed" &&
      receipt._count.expenses === 0 &&
      receipt.totalCents != null &&
      receipt.totalCents > 0,
  });
}
