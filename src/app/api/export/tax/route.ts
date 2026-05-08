import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { localCalendarYearBounds, parseTaxYear } from "@/lib/taxYear";
import { taxCategoryLabel } from "@/lib/taxCategories";

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const year = parseTaxYear(searchParams.get("year"), new Date().getFullYear());
  const { start, end } = localCalendarYearBounds(year);

  const rows = await prisma.expense.findMany({
    where: {
      spentAt: { gte: start, lt: end },
      taxQualifying: true,
    },
    orderBy: { spentAt: "asc" },
    include: {
      user: { select: { name: true } },
      monthlyPeriod: { select: { yearMonth: true } },
      taxReviewedBy: { select: { name: true } },
    },
  });

  const header = [
    "date",
    "amount_dollars",
    "description",
    "payee",
    "tax_folder",
    "tax_note",
    "tax_reviewed_date",
    "tax_reviewed_by",
    "calendar_month",
    "source",
    "user",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const amt = (r.amountCents / 100).toFixed(2);
    lines.push(
      [
        r.spentAt.toISOString().slice(0, 10),
        amt,
        csvEscape(r.description),
        csvEscape(r.payee ?? ""),
        csvEscape(taxCategoryLabel(r.taxCategory)),
        csvEscape(r.taxNote ?? ""),
        r.taxReviewedAt ? r.taxReviewedAt.toISOString().slice(0, 10) : "",
        csvEscape(r.taxReviewedBy?.name ?? ""),
        r.monthlyPeriod.yearMonth,
        r.source,
        csvEscape(r.user?.name ?? ""),
      ].join(","),
    );
  }
  const body = lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tax-qualifying-${year}.csv"`,
    },
  });
}
