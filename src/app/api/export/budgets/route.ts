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
  const rows = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { name: "asc" },
  });
  const header = [
    "name",
    "category",
    "limit_dollars",
    "rolled_in_dollars",
    "note",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.name),
        csvEscape(r.category ?? ""),
        (r.limitCents / 100).toFixed(2),
        (r.rolledInCents / 100).toFixed(2),
        csvEscape(r.note ?? ""),
      ].join(","),
    );
  }
  const body = lines.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budgets-${ym}.csv"`,
    },
  });
}
