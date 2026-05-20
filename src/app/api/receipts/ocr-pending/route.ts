import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const ymRaw = url.searchParams.get("ym")?.trim();
  const yearMonth =
    ymRaw?.match(/^\d{4}-\d{2}$/) ? ymRaw : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const count = await prisma.receipt.count({
    where: {
      monthlyPeriodId: period.id,
      ocrStatus: { in: ["pending", "processing"] },
    },
  });
  return NextResponse.json({ count, yearMonth });
}
