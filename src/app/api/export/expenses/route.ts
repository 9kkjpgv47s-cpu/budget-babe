import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

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
  const ym = searchParams.get("ym")?.match(/^\d{4}-\d{2}$/)
    ? searchParams.get("ym")!
    : null;
  if (!ym) {
    return new NextResponse("Missing ym", { status: 400 });
  }
  const period = await getOrCreateMonthlyPeriod(ym);
  const rows = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { spentAt: "asc" },
    include: { user: { select: { name: true } } },
  });
  const header = [
    "date",
    "amount_dollars",
    "description",
    "payee",
    "tags_json",
    "budget_plan_id",
    "receipt_id",
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
        csvEscape(r.tagsJson ?? ""),
        r.budgetPlanId ?? "",
        r.receiptId ?? "",
        r.source,
        csvEscape(r.user?.name ?? ""),
      ].join(","),
    );
  }
  const body = lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${ym}.csv"`,
    },
  });
}
