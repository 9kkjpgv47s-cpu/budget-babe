import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ym = searchParams.get("ym")?.trim();
  if (!ym?.match(/^\d{4}-\d{2}$/)) {
    return NextResponse.json({ error: "Invalid ym" }, { status: 400 });
  }

  const period = await getOrCreateMonthlyPeriod(ym);
  const counts = await prisma.receipt.groupBy({
    by: ["ocrStatus"],
    where: { monthlyPeriodId: period.id },
    _count: { _all: true },
  });

  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  for (const row of counts) {
    const n = row._count._all;
    if (row.ocrStatus === "pending") pending += n;
    else if (row.ocrStatus === "processing") processing += n;
    else if (row.ocrStatus === "completed") completed += n;
    else if (row.ocrStatus === "failed" || row.ocrStatus === "skipped") {
      failed += n;
    }
  }

  const active = pending > 0 || processing > 0;

  return NextResponse.json({
    active,
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  });
}
