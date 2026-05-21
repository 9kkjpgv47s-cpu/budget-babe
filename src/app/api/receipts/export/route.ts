import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { displayFilename } from "@/app/(app)/receipts/receiptDisplay";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

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
    include: {
      user: { select: { name: true } },
      _count: { select: { expenses: true } },
    },
  });

  const header = [
    "id",
    "filename",
    "uploaded_at",
    "user",
    "total_cents",
    "ocr_status",
    "ocr_confidence",
    "expense_count",
    "note",
  ].join(",");
  const rows = receipts.map((r) =>
    [
      r.id,
      displayFilename(r.filename),
      r.uploadedAt.toISOString(),
      r.user?.name ?? "",
      r.totalCents != null ? String(r.totalCents) : "",
      r.ocrStatus,
      r.ocrConfidence != null ? String(r.ocrConfidence) : "",
      String(r._count.expenses),
      r.note ?? "",
    ]
      .map((c) => csvEscape(String(c)))
      .join(","),
  );

  const body = [header, ...rows].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receipts-${yearMonth}.csv"`,
    },
  });
}
