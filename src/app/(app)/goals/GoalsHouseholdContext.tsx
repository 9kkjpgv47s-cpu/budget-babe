import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboardData";
import { buildPaycheckCoach } from "@/lib/paycheckCoach";
import { formatCents } from "@/lib/money";

export async function GoalsHouseholdContext({ yearMonth }: { yearMonth: string }) {
  const [data, goalTotals] = await Promise.all([
    getDashboardData(yearMonth),
    prisma.savingsGoal.aggregate({
      _sum: { savedAmountCents: true, targetAmountCents: true },
      _count: true,
    }),
  ]);

  const coach = buildPaycheckCoach({
    monthlyIncomeCents: data.incomeCents,
    payPeriodsPerMonth: data.payPeriodsPerMonth,
    savingsRatePercent: data.savingsRatePercentTarget,
    nextPaycheck: data.nextPaycheckDate,
    bills: data.bills.map((b) => ({
      id: b.id,
      title: b.title,
      amountCents: b.amountCents,
      dueDate: b.dueDate,
      paid: b.paid,
    })),
    budgetPlans: data.budgetPlans.map((p) => ({
      name: p.name,
      category: p.category,
      limitCents: p.limitCents,
      rolledInCents: p.rolledInCents,
    })),
    monthSpendCents: data.spentTotal,
  });

  const savedTotal = goalTotals._sum.savedAmountCents ?? 0;
  const targetTotal = goalTotals._sum.targetAmountCents ?? 0;
  const coachMonthlySave =
    coach != null
      ? coach.savingsThisPayCents * data.payPeriodsPerMonth
      : null;

  return (
    <section className="rounded-xl border border-violet-200/80 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/25">
      <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
        Cash flow context ({yearMonth})
      </h2>
      <p className="mt-1 text-xs text-violet-950/80 dark:text-violet-100/80">
        Goal progress is manual — these numbers help you compare targets to real
        household income from the overview (not bank-linked).
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-violet-800/70 dark:text-violet-200/70">
            Overview income
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.incomeCents)}
          </dd>
          <dd className="text-xs text-violet-900/70 dark:text-violet-100/70">
            {data.paychecks.length > 0
              ? `${data.paychecks.length} paycheck${data.paychecks.length === 1 ? "" : "s"}`
              : "Add paychecks on overview"}
          </dd>
        </div>
        {coachMonthlySave != null ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-violet-800/70 dark:text-violet-200/70">
              Coach save target (month)
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
              {formatCents(coachMonthlySave)}
            </dd>
            <dd className="text-xs text-violet-900/70 dark:text-violet-100/70">
              {data.savingsRatePercentTarget}% × {data.payPeriodsPerMonth} check
              {data.payPeriodsPerMonth === 1 ? "" : "s"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-violet-800/70 dark:text-violet-200/70">
            Spent this month
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.spentTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-violet-800/70 dark:text-violet-200/70">
            All goals saved (manual)
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(savedTotal)}
          </dd>
          <dd className="text-xs text-violet-900/70 dark:text-violet-100/70">
            of {formatCents(targetTotal)} across {goalTotals._count} goal
            {goalTotals._count === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs">
        <Link href={`/?ym=${yearMonth}`} className="text-emerald-700 underline dark:text-emerald-400">
          Overview
        </Link>
        {" · "}
        <Link href={`/coach?ym=${yearMonth}`} className="text-emerald-700 underline dark:text-emerald-400">
          Coach settings
        </Link>
      </p>
    </section>
  );
}
