import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardData";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";
import { buildPaycheckCoach } from "@/lib/paycheckCoach";
import {
  buildGoalsCoachRecommendations,
  snapshotGoalsForCoach,
} from "@/lib/coachGoalRecommendations";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";
import { CoachSettingsForm } from "./CoachSettingsForm";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const [data, savingsGoals] = await Promise.all([
    getDashboardData(ym),
    prisma.savingsGoal.findMany({
      orderBy: { title: "asc" },
      select: {
        title: true,
        targetAmountCents: true,
        savedAmountCents: true,
      },
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

  const coachMonthlySave =
    coach != null
      ? coach.savingsThisPayCents * data.payPeriodsPerMonth
      : 0;
  const goalRecs =
    coach != null
      ? buildGoalsCoachRecommendations(
          coachMonthlySave,
          data.payPeriodsPerMonth,
          snapshotGoalsForCoach(savingsGoals),
        )
      : [];
  const allRecommendations = coach
    ? [...coach.recommendations, ...goalRecs]
    : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paycheck coach</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Recommendations from your income, next paycheck, bills, and savings
            target — geared toward ending each pay period with cushion.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/goals?ym=${ym}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-4 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
          >
            Savings goals
          </Link>
          <Link
            href={`/?ym=${ym}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            Overview
          </Link>
        </div>
      </div>

      <MonthWorkflowLinks yearMonth={ym} />

      <section className="card p-5">
        <h2 className="font-medium">Household snapshot ({ym})</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly income (this app)
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatCents(data.incomeCents)}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {data.paychecks.length > 0
                ? `${data.paychecks.length} paycheck row${data.paychecks.length === 1 ? "" : "s"} on overview`
                : "Add paychecks on overview — same number coach uses"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next paycheck (overview)
            </dt>
            <dd className="mt-0.5 text-lg font-semibold">
              {data.nextPaycheckDate
                ? data.nextPaycheckDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Not set"}
            </dd>
            <dd className="text-xs text-muted-foreground">
              <Link href={`/?ym=${ym}`} className="text-accent underline">
                Edit on overview →
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Coach settings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Savings rate and paychecks-per-month live here. Next payday and deposit
          logging stay on the overview so every screen shares the same dates.
        </p>
        <div className="mt-4">
          <CoachSettingsForm
            yearMonth={ym}
            savingsRatePercentTarget={data.savingsRatePercentTarget}
            payPeriodsPerMonth={data.payPeriodsPerMonth}
            nextPaycheckDate={data.nextPaycheckDate}
            incomeCents={data.incomeCents}
          />
        </div>
      </section>

      {!coach ? (
        <p className="text-sm text-muted-foreground">
          Add at least one paycheck on the overview (and paychecks per month ≥
          1) to see recommendations.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Per paycheck (income ÷ {data.payPeriodsPerMonth})
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.perPaycheckIncomeCents)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Save this check ({coach.savingsRatePercent}%)
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-accent ">
                {formatCents(coach.savingsThisPayCents)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested grocery cap
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.suggestedGroceryCapCents)}
              </div>
              {coach.groceryBudgetLimitCents != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Budget line: {formatCents(coach.groceryBudgetLimitCents)}
                </p>
              ) : null}
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Free spending cap
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.freeSpendingCapCents)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                After savings, bills, and grocery cap
              </p>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-medium">Two-week window after pay</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.nextPaycheckDate
                ? `Bills due after ${data.nextPaycheckDate.toLocaleDateString()} through two weeks out, plus bills due on or before payday.`
                : "Set next paycheck on the overview to anchor this plan."}
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Week 1 (days 1–7 after pay)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bills: {formatCents(coach.week1BillsSumCents)} · Soft discretionary
                  guide: {formatCents(coach.week1DiscretionaryGuideCents)}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {coach.week1Bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCents(b.amountCents)} ·{" "}
                        {b.dueDate.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {coach.week1Bills.length === 0 ? (
                    <li className="text-muted-foreground">No bills in this slice.</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Week 2 (days 8–14 after pay)
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bills: {formatCents(coach.week2BillsSumCents)} · Soft discretionary
                  guide: {formatCents(coach.week2DiscretionaryGuideCents)}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {coach.week2Bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCents(b.amountCents)} ·{" "}
                        {b.dueDate.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {coach.week2Bills.length === 0 ? (
                    <li className="text-muted-foreground">No bills in this slice.</li>
                  ) : null}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm dark:bg-zinc-900/80">
              <span className="font-medium">Bills due on or before payday: </span>
              {formatCents(coach.billsBeforePaySumCents)}
              <span className="text-muted-foreground">
                {" "}
                ({coach.billsBeforePay.length} unpaid)
              </span>
              {" · "}
              <span className="font-medium">Bills in two weeks after pay: </span>
              {formatCents(coach.billsAfterPayTwoWeeksSumCents)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              After savings and all of the above:{" "}
              <span
                className={
                  coach.afterObligationsCents < 0
                    ? "font-semibold text-red-600"
                    : "font-semibold text-accent "
                }
              >
                {formatCents(coach.afterObligationsCents)}
              </span>{" "}
              before grocery and free-spending caps (see cards above).
            </p>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Recommendations</h2>
              <Link
                href={`/goals?ym=${ym}`}
                className="text-xs font-medium text-violet-700 underline dark:text-violet-300"
              >
                Update goal progress →
              </Link>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground">
              {allRecommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
