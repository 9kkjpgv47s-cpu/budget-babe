import Link from "next/link";
import { addMonths, format, getDate } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import {
  spentForBudgetPlan,
  envelopeRemaining,
  type BudgetPlanForRollup,
  type ExpenseForRollup,
} from "@/lib/budgetRollup";
import { BudgetCopyHeader } from "./BudgetCopyHeader";
import { BillRow, BillsSectionHeader } from "./BillRow";
import { BudgetPlanRow } from "./BudgetPlanRow";
import { DashboardPanel } from "./DashboardPanel";
import { HomeMobileInsights } from "./HomeMobileInsights";
import { PaychecksPanel } from "./PaychecksPanel";
import { QuickForms } from "./QuickForms";
import { applySuggestedRolloversAction } from "@/app/actions/rollover";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
}

type ExpensePoint = {
  id: string;
  amountCents: number;
  spentAt: Date;
  description: string;
  tagsJson: string | null;
  payee: string | null;
  budgetPlanId: string | null;
};

function isLikelyGroceryExpense(exp: ExpensePoint): boolean {
  const haystack = `${exp.description} ${exp.payee ?? ""} ${exp.tagsJson ?? ""}`
    .toLowerCase()
    .trim();
  return /grocery|grocer|supermarket|market|aldi|kroger|publix|costco|walmart/.test(
    haystack,
  );
}

function sumCents(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : undefined;
  const yearMonth = ym ?? currentYearMonth();
  const data = await getDashboardData(yearMonth);
  const prevYm = shiftYearMonth(yearMonth, -1);
  const nextYm = shiftYearMonth(yearMonth, 1);
  const prevPeriodExists =
    (await prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } })) !=
    null;

  const expForRollup: ExpenseForRollup[] = data.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    budgetPlanId: e.budgetPlanId,
    tagsJson: e.tagsJson,
  }));

  const budgetRows = data.budgetPlans.map((p) => {
    const planR: BudgetPlanForRollup = {
      id: p.id,
      name: p.name,
      category: p.category,
      limitCents: p.limitCents,
      rolledInCents: p.rolledInCents,
    };
    const spent = spentForBudgetPlan(planR, expForRollup);
    const remaining = envelopeRemaining(planR, spent);
    return { plan: p, spent, remaining };
  });

  const historyYms = [
    shiftYearMonth(yearMonth, -1),
    shiftYearMonth(yearMonth, -2),
    shiftYearMonth(yearMonth, -3),
  ];
  const calendarYms = [prevYm, yearMonth, nextYm];
  const lookupYms = Array.from(new Set([...historyYms, ...calendarYms]));

  const periodSnapshots = await prisma.monthlyPeriod.findMany({
    where: { yearMonth: { in: lookupYms } },
    select: {
      yearMonth: true,
      incomeCents: true,
      bills: {
        select: {
          amountCents: true,
          dueDate: true,
          paid: true,
        },
      },
      budgetPlans: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      expenses: {
        select: {
          id: true,
          amountCents: true,
          spentAt: true,
          description: true,
          tagsJson: true,
          payee: true,
          budgetPlanId: true,
        },
      },
    },
  });

  const periodByMonth = new Map<
    string,
    {
      incomeCents: number;
      bills: { amountCents: number; dueDate: Date; paid: boolean }[];
      budgetPlans: { id: string; name: string; category: string | null }[];
      expenses: ExpensePoint[];
    }
  >();
  for (const period of periodSnapshots) {
    periodByMonth.set(period.yearMonth, {
      incomeCents: period.incomeCents,
      bills: period.bills,
      budgetPlans: period.budgetPlans,
      expenses: period.expenses,
    });
  }

  const historyGroceryMonthly = historyYms.map((ymKey) =>
    sumCents(
      (periodByMonth.get(ymKey)?.expenses ?? [])
        .filter((e) => isLikelyGroceryExpense(e))
        .map((e) => e.amountCents),
    ),
  );
  const groceryBudgetPlan = data.budgetPlans.find(
    (p) =>
      p.name.toLowerCase().includes("grocer") ||
      (p.category?.toLowerCase().includes("grocer") ?? false),
  );
  const groceryHistoryNonZero = historyGroceryMonthly.filter((v) => v > 0);
  const expectedGroceriesMonthlyCents =
    groceryHistoryNonZero.length > 0
      ? Math.round(
          groceryHistoryNonZero.reduce((s, v) => s + v, 0) /
            groceryHistoryNonZero.length,
        )
      : groceryBudgetPlan
        ? groceryBudgetPlan.limitCents + groceryBudgetPlan.rolledInCents
        : 0;

  const trendMonths = [prevYm, yearMonth, nextYm].map((ymKey) => {
    const period = periodByMonth.get(ymKey);
    const monthExpenses = period?.expenses ?? [];
    const monthBills = period?.bills ?? [];
    const monthIncome = period?.incomeCents ?? 0;
    const expectedGroceriesBiweeklyCents = Math.round(expectedGroceriesMonthlyCents / 2);

    const slices = [1, 2].map((periodIdx) => {
      const isFirst = periodIdx === 1;
      const spent = sumCents(
        monthExpenses
          .filter((e) => (isFirst ? getDate(e.spentAt) <= 14 : getDate(e.spentAt) > 14))
          .map((e) => e.amountCents),
      );
      const unpaidBills = sumCents(
        monthBills
          .filter((b) => !b.paid)
          .filter((b) => (isFirst ? getDate(b.dueDate) <= 14 : getDate(b.dueDate) > 14))
          .map((b) => b.amountCents),
      );
      const circulation =
        Math.round(monthIncome / 2) - spent - unpaidBills - expectedGroceriesBiweeklyCents;
      return {
        label: isFirst ? "Days 1-14" : "Days 15-end",
        spent,
        unpaidBills,
        expectedGroceries: expectedGroceriesBiweeklyCents,
        circulation,
      };
    });

    const spentTotal = sumCents(monthExpenses.map((e) => e.amountCents));
    const unpaidBillsTotal = sumCents(
      monthBills.filter((b) => !b.paid).map((b) => b.amountCents),
    );
    const today = new Date();
    const parsedMonth = parseYearMonth(ymKey);
    const daysInMonth = new Date(
      parsedMonth.getFullYear(),
      parsedMonth.getMonth() + 1,
      0,
    ).getDate();
    const isCurrent = ymKey === yearMonth;
    const elapsedDays = isCurrent ? Math.max(1, today.getDate()) : daysInMonth;
    const spentSoFar = isCurrent
      ? sumCents(
          monthExpenses
            .filter((e) => getDate(e.spentAt) <= today.getDate())
            .map((e) => e.amountCents),
        )
      : spentTotal;
    const projectedSpentCents = Math.round((spentSoFar / elapsedDays) * daysInMonth);
    const projectedCirculationCents =
      monthIncome - unpaidBillsTotal - expectedGroceriesMonthlyCents - projectedSpentCents;

    return {
      yearMonth: ymKey,
      incomeCents: monthIncome,
      spentTotal,
      unpaidBillsTotal,
      expectedGroceriesMonthCents: expectedGroceriesMonthlyCents,
      projectedCirculationCents,
      slices,
    };
  });

  const calendarMonths = [prevYm, yearMonth, nextYm].map((ymKey) => {
    const monthExpenses = periodByMonth.get(ymKey)?.expenses ?? [];
    return {
      yearMonth: ymKey,
      expenses: monthExpenses.map((e) => ({
        id: e.id,
        amountCents: e.amountCents,
        spentAtIso: e.spentAt.toISOString(),
        budgetPlanId: e.budgetPlanId,
      })),
    };
  });

  const budgetPlanOptions = Array.from(
    new Map(
      lookupYms
        .flatMap((ymKey) => periodByMonth.get(ymKey)?.budgetPlans ?? [])
        .map((p) => [p.id, p] as const),
    ).values(),
  );

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">This month</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Income, spending, bills before payday, and what is left.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <a
            className="rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/?ym=${prevYm}`}
          >
            ←
          </a>
          <span className="min-w-[7rem] text-center font-medium tabular-nums">
            {yearMonth}
          </span>
          <a
            className="rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/?ym=${nextYm}`}
          >
            →
          </a>
        </div>
      </div>

      <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              Add entries first
            </h2>
            <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
              Primary input zone for {yearMonth}: spending, bills, envelopes, and paychecks.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/receipts"
              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition-all duration-200 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
            >
              Receipt upload
            </Link>
            <Link
              href={`/expenses?ym=${yearMonth}`}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-500"
            >
              Open entries
            </Link>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-900/60 dark:bg-zinc-900">
          <QuickForms yearMonth={yearMonth} />
        </div>
      </section>

      <section className="md:hidden">
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          <div className="min-w-[84%] snap-start">
            <StatCard
              label="Income"
              value={formatCents(data.incomeCents)}
              hint={
                data.paychecks.length > 0
                  ? `${data.paychecks.length} paycheck${data.paychecks.length === 1 ? "" : "s"} this month`
                  : data.period.incomeCents > 0
                    ? "Legacy planned income until you add paycheck rows"
                    : "Add paychecks via Household settings or Quick add"
              }
            />
          </div>
          <div className="min-w-[84%] snap-start">
            <StatCard label="Spent so far" value={formatCents(data.spentTotal)} />
          </div>
          <div className="min-w-[84%] snap-start">
            <StatCard
              label="Bills before next paycheck"
              value={formatCents(data.billsBeforePaySum)}
              hint={
                data.nextPaycheckDate
                  ? `Due on or before ${data.nextPaycheckDate.toLocaleDateString()}`
                  : "Set your next paycheck date below"
              }
            />
          </div>
          <div className="min-w-[84%] snap-start">
            <StatCard
              label="Left after those bills & spending"
              value={formatCents(data.leftAfterUpcomingBills)}
              hint="Income minus spending minus unpaid bills due on or before payday"
            />
          </div>
          <div className="min-w-[84%] snap-start">
            <StatCard
              label="Left after all unpaid bills"
              value={formatCents(data.leftAfterAllBills)}
              hint="Income minus spending minus every bill still marked unpaid"
            />
          </div>
        </div>
      </section>
      <section className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Income"
          value={formatCents(data.incomeCents)}
          hint={
            data.paychecks.length > 0
              ? `${data.paychecks.length} paycheck${data.paychecks.length === 1 ? "" : "s"} this month`
              : data.period.incomeCents > 0
                ? "Legacy planned income until you add paycheck rows"
                : "Add paychecks via Household settings or Quick add"
          }
        />
        <StatCard label="Spent so far" value={formatCents(data.spentTotal)} />
        <StatCard
          label="Bills before next paycheck"
          value={formatCents(data.billsBeforePaySum)}
          hint={
            data.nextPaycheckDate
              ? `Due on or before ${data.nextPaycheckDate.toLocaleDateString()}`
              : "Set your next paycheck date below"
          }
        />
        <StatCard
          label="Left after those bills & spending"
          value={formatCents(data.leftAfterUpcomingBills)}
          hint="Income minus spending minus unpaid bills due on or before payday"
        />
        <StatCard
          label="Left after all unpaid bills"
          value={formatCents(data.leftAfterAllBills)}
          hint="Income minus spending minus every bill still marked unpaid"
        />
      </section>

      <section className="grid grid-cols-2 gap-2 md:hidden">
        <Link
          href={`/expenses?ym=${yearMonth}`}
          className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-500 active:scale-[0.98] motion-reduce:transition-none"
        >
          Add expense
        </Link>
        <Link
          href={`/bills?ym=${yearMonth}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition-all duration-200 hover:bg-zinc-100 active:scale-[0.98] motion-reduce:transition-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Review bills
        </Link>
      </section>

      <HomeMobileInsights
        trendMonths={trendMonths}
        calendarMonths={calendarMonths}
        budgetPlanOptions={budgetPlanOptions}
      />

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-emerald-900 dark:text-emerald-100">
              Paycheck coach
            </h2>
            <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/90">
              Savings rate (5–40%), grocery and free-spending caps, and a two-week
              bill plan after your next pay date.
            </p>
          </div>
          <Link
            href={`/coach?ym=${yearMonth}`}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Open coach
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Tax records</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Qualifying expense folder, audit notes, review trail, and CSV export by calendar year.
            </p>
          </div>
          <Link
            href={`/tax?year=${yearMonth.slice(0, 4)}`}
            className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Open tax ({yearMonth.slice(0, 4)})
          </Link>
        </div>
      </section>

      {data.savingsGoals.length > 0 ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-violet-900 dark:text-violet-100">
                Savings goals
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-violet-950/90 dark:text-violet-100/90">
                {data.savingsGoals.map((g) => {
                  const pct =
                    g.targetAmountCents > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (g.savedAmountCents / g.targetAmountCents) * 100,
                          ),
                        )
                      : 0;
                  return (
                    <li key={g.id} className="flex justify-between gap-2 tabular-nums">
                      <span>{g.title}</span>
                      <span>{pct}% saved</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <Link
              href="/goals"
              className="shrink-0 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              View goals
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Household settings</h2>
        <DashboardPanel
          yearMonth={yearMonth}
          nextPaycheckDate={data.nextPaycheckDate}
          monthlyNotes={data.period.notes}
        />
        <PaychecksPanel
          yearMonth={yearMonth}
          paychecks={data.paychecks}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Budget plans</h2>
        <p className="mt-1 text-sm">
          <Link href={`/budgets?ym=${yearMonth}`} className="text-emerald-600 underline">
            Full budgets page
          </Link>
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Spending matches by description, tags, or linked budget on each
          expense. Each line has a monthly limit plus optional{" "}
          <strong>rolled-in</strong> balance from last month.
        </p>
        <form action={applySuggestedRolloversAction} className="mt-3">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <button
            type="submit"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          >
            Apply suggested rollovers from {prevYm}
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            Sets rolled-in to unused balance from the prior month for lines with
            the same name.
          </p>
        </form>
        <BudgetCopyHeader
          yearMonth={yearMonth}
          prevYm={prevYm}
          hasPrevPeriod={prevPeriodExists}
        />
        {budgetRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No budget lines yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {budgetRows.map(({ plan, spent, remaining }) => (
              <BudgetPlanRow
                key={plan.id}
                yearMonth={yearMonth}
                plan={plan}
                spent={spent}
                remaining={remaining}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Bills</h2>
          <p className="mt-1 text-sm">
            <Link href={`/bills?ym=${yearMonth}`} className="text-emerald-600 underline">
              Full bills page
            </Link>
          </p>
          <BillsSectionHeader
            yearMonth={yearMonth}
            prevYm={prevYm}
            hasPrevPeriod={prevPeriodExists}
          />
          <ul className="mt-3 space-y-2 text-sm">
            {data.bills.map((b) => (
              <BillRow key={b.id} yearMonth={yearMonth} bill={b} />
            ))}
            {data.bills.length === 0 ? (
              <li className="text-zinc-500">No bills for this month.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Recent expenses</h2>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {data.expenses.map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-2 border-b border-zinc-50 pb-2 dark:border-zinc-800/80"
              >
                <span>
                  {e.description}
                  {e.user ? (
                    <span className="text-xs text-zinc-400"> · {e.user.name}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCents(e.amountCents)}
                </span>
              </li>
            ))}
            {data.expenses.length === 0 ? (
              <li className="text-zinc-500">No expenses logged.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Receipts</h2>
          <a href="/receipts" className="text-sm text-emerald-600 underline">
            Manage receipts
          </a>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.receipts.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-zinc-100 p-3 text-sm dark:border-zinc-800"
            >
              <a
                className="font-medium text-emerald-700 underline dark:text-emerald-400"
                href={`/api/receipts/${r.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {r.filename}
              </a>
              {r.totalCents != null ? (
                <div className="text-zinc-600">{formatCents(r.totalCents)}</div>
              ) : null}
              {r.note ? <div className="text-xs text-zinc-500">{r.note}</div> : null}
            </li>
          ))}
        </ul>
        {data.receipts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No receipts this month.</p>
        ) : null}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow duration-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{hint}</p> : null}
    </div>
  );
}
