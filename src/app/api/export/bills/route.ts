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
  const bills = await prisma.bill.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { dueDate: "asc" },
  });
  const header = ["title", "amount_dollars", "due_date", "paid"];
  const lines = [header.join(",")];
  for (const b of bills) {
    lines.push(
      [
        csvEscape(b.title),
        (b.amountCents / 100).toFixed(2),
        b.dueDate.toISOString().slice(0, 10),
        b.paid ? "yes" : "no",
      ].join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bills-${ym}.csv"`,
    },
  });
}
