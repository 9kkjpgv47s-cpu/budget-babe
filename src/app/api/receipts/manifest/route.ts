import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { displayFilename } from "@/app/(app)/receipts/receiptDisplay";
import { parseMerchantFromOcrText } from "@/lib/receiptOcr";

/** JSON manifest of receipt files for tax backup (download URLs are authenticated). */
export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const ymRaw = url.searchParams.get("ym")?.trim();
  const yearMonth =
    ymRaw?.match(/^\d{4}-\d{2}$/) ? ymRaw : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const receipts = await prisma.receipt.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      filename: true,
      uploadedAt: true,
      totalCents: true,
      ocrStatus: true,
      ocrRawText: true,
      _count: { select: { expenses: true } },
    },
  });

  return NextResponse.json({
    yearMonth,
    count: receipts.length,
    receipts: receipts.map((r) => ({
      id: r.id,
      label: displayFilename(r.filename),
      uploadedAt: r.uploadedAt.toISOString(),
      totalCents: r.totalCents,
      ocrStatus: r.ocrStatus,
      expenseCount: r._count.expenses,
      merchantGuess: parseMerchantFromOcrText(r.ocrRawText ?? "") ?? null,
      downloadPath: `/api/receipts/${r.id}`,
    })),
  });
}
