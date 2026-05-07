import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardData";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";
import { buildPaycheckCoach } from "@/lib/paycheckCoach";
import { CoachSettingsForm } from "./CoachSettingsForm";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const data = await getDashboardData(ym);

  const coach = buildPaycheckCoach({
    monthlyIncomeCents: data.period.incomeCents,
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paycheck coach</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Recommendations from your income, next paycheck, bills, and savings
          target — geared toward ending each pay period with cushion.
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${ym}`} className="text-emerald-600 underline">
            ← Overview ({ym})
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Coach settings</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Set paycheck date and monthly income on the overview. Here you choose
          how aggressively to save each check.
        </p>
        <div className="mt-4">
          <CoachSettingsForm
            savingsRatePercentTarget={data.savingsRatePercentTarget}
            payPeriodsPerMonth={data.payPeriodsPerMonth}
          />
        </div>
      </section>

      {!coach ? (
        <p className="text-sm text-zinc-500">
          Add planned monthly income on the overview (and paychecks per month ≥
          1) to see recommendations.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Per paycheck (income ÷ {data.payPeriodsPerMonth})
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.perPaycheckIncomeCents)}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Save this check ({coach.savingsRatePercent}%)
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCents(coach.savingsThisPayCents)}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Suggested grocery cap
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.suggestedGroceryCapCents)}
              </div>
              {coach.groceryBudgetLimitCents != null ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Budget line: {formatCents(coach.groceryBudgetLimitCents)}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Free spending cap
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {formatCents(coach.freeSpendingCapCents)}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                After savings, bills, and grocery cap
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-medium">Two-week window after pay</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {data.nextPaycheckDate
                ? `Bills due after ${data.nextPaycheckDate.toLocaleDateString()} through two weeks out, plus bills due on or before payday.`
                : "Set next paycheck on the overview to anchor this plan."}
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Week 1 (days 1–7 after pay)
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Bills: {formatCents(coach.week1BillsSumCents)} · Soft discretionary
                  guide: {formatCents(coach.week1DiscretionaryGuideCents)}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {coach.week1Bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.title}</span>
                      <span className="shrink-0 tabular-nums text-zinc-600">
                        {formatCents(b.amountCents)} ·{" "}
                        {b.dueDate.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {coach.week1Bills.length === 0 ? (
                    <li className="text-zinc-500">No bills in this slice.</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Week 2 (days 8–14 after pay)
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Bills: {formatCents(coach.week2BillsSumCents)} · Soft discretionary
                  guide: {formatCents(coach.week2DiscretionaryGuideCents)}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {coach.week2Bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.title}</span>
                      <span className="shrink-0 tabular-nums text-zinc-600">
                        {formatCents(b.amountCents)} ·{" "}
                        {b.dueDate.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {coach.week2Bills.length === 0 ? (
                    <li className="text-zinc-500">No bills in this slice.</li>
                  ) : null}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/80">
              <span className="font-medium">Bills due on or before payday: </span>
              {formatCents(coach.billsBeforePaySumCents)}
              <span className="text-zinc-500">
                {" "}
                ({coach.billsBeforePay.length} unpaid)
              </span>
              {" · "}
              <span className="font-medium">Bills in two weeks after pay: </span>
              {formatCents(coach.billsAfterPayTwoWeeksSumCents)}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              After savings and all of the above:{" "}
              <span
                className={
                  coach.afterObligationsCents < 0
                    ? "font-semibold text-red-600"
                    : "font-semibold text-emerald-700 dark:text-emerald-400"
                }
              >
                {formatCents(coach.afterObligationsCents)}
              </span>{" "}
              before grocery and free-spending caps (see cards above).
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-medium">Recommendations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {coach.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
