import Link from "next/link";
import { addMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import { BillAddForm } from "../BillAddForm";
import { BillRow, BillsSectionHeader } from "../BillRow";
import { MonthNav } from "@/components/ui";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(ym);
  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  const [bills, prevExists] = await Promise.all([
    prisma.bill.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { dueDate: "asc" },
    }),
    prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All bills for the month, copy from last month, and quick add.
          </p>
          <p className="mt-2 text-sm">
            <Link href={`/?ym=${ym}`} className="text-accent underline">
              ← Overview ({ym})
            </Link>
          </p>
        </div>
        <MonthNav yearMonth={ym} prevYm={prevYm} nextYm={nextYm} />
      </div>

      <section className="card p-5">
        <h2 className="font-medium">This month ({bills.length})</h2>
        <BillsSectionHeader
          yearMonth={ym}
          prevYm={prevYm}
          hasPrevPeriod={prevExists != null}
        />
        <ul className="mt-4 space-y-2 text-sm">
          {bills.map((b) => (
            <BillRow key={b.id} yearMonth={ym} bill={b} />
          ))}
        </ul>
        {bills.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No bills for this month.</p>
        ) : null}
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Add bill</h2>
        <BillAddForm yearMonth={ym} heading={null} />
      </section>
    </div>
  );
}
