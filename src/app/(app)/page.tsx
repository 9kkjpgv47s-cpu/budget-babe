import Link from "next/link";
import {
  addMonths,
  format,
  getDate,
  getDay,
  getDaysInMonth,
  startOfMonth,
} from "date-fns";
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
      expenses: {
        select: {
          id: true,
          amountCents: true,
          spentAt: true,
          description: true,
          tagsJson: true,
          payee: true,
        },
      },
    },
  });

  const expenseByMonth = new Map<string, ExpensePoint[]>();
  for (const period of periodSnapshots) {
    expenseByMonth.set(period.yearMonth, period.expenses);
  }

  const historyGroceryMonthly = historyYms.map((ymKey) =>
    sumCents(
      (expenseByMonth.get(ymKey) ?? [])
        .filter((e) => isLikelyGroceryExpense(e))
        .map((e) => e.amountCents),
    ),
  );
  const groceryHistoryNonZero = historyGroceryMonthly.filter((v) => v > 0);
  const groceryBudgetPlan = data.budgetPlans.find(
    (p) =>
      p.name.toLowerCase().includes("grocer") ||
      (p.category?.toLowerCase().includes("grocer") ?? false),
  );
  const expectedGroceriesBiweeklyCents =
    groceryHistoryNonZero.length > 0
      ? Math.round(
          groceryHistoryNonZero.reduce((s, v) => s + v, 0) /
            groceryHistoryNonZero.length /
            2,
        )
      : groceryBudgetPlan
        ? Math.round((groceryBudgetPlan.limitCents + groceryBudgetPlan.rolledInCents) / 2)
        : 0;

  const biweekly = [1, 2].map((periodIdx) => {
    const isFirst = periodIdx === 1;
    const spent = sumCents(
      data.expenses
        .filter((e) => (isFirst ? getDate(e.spentAt) <= 14 : getDate(e.spentAt) > 14))
        .map((e) => e.amountCents),
    );
    const unpaidBills = sumCents(
      data.bills
        .filter((b) => !b.paid)
        .filter((b) => (isFirst ? getDate(b.dueDate) <= 14 : getDate(b.dueDate) > 14))
        .map((b) => b.amountCents),
    );
    const incomeSlice = Math.round(data.incomeCents / 2);
    const circulation = incomeSlice - spent - unpaidBills - expectedGroceriesBiweeklyCents;
    return {
      label: isFirst ? "Days 1-14" : "Days 15-end",
      spent,
      unpaidBills,
      expectedGroceries: expectedGroceriesBiweeklyCents,
      circulation,
    };
  });

  const biweeklyMax = Math.max(
    1,
    ...biweekly.flatMap((b) => [
      b.spent,
      b.unpaidBills,
      b.expectedGroceries,
      Math.max(0, b.circulation),
    ]),
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">This month</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Income, spending, bills before payday, and what is left.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <a
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/?ym=${prevYm}`}
          >
            ←
          </a>
          <span className="min-w-[7rem] text-center font-medium tabular-nums">
            {yearMonth}
          </span>
          <a
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/?ym=${nextYm}`}
          >
            →
          </a>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Two-week cashflow (mobile planner)</h2>
          <span className="text-xs text-zinc-500">Expected groceries from recent months</span>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {biweekly.map((b) => (
            <div
              key={b.label}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="text-sm font-medium">{b.label}</div>
              <div className="mt-2 space-y-2">
                <MiniBar
                  label="Spent"
                  value={b.spent}
                  max={biweeklyMax}
                  color="bg-rose-500"
                />
                <MiniBar
                  label="Bills to pay"
                  value={b.unpaidBills}
                  max={biweeklyMax}
                  color="bg-amber-500"
                />
                <MiniBar
                  label="Expected groceries"
                  value={b.expectedGroceries}
                  max={biweeklyMax}
                  color="bg-emerald-500"
                />
                <MiniBar
                  label="Circulation left"
                  value={Math.max(0, b.circulation)}
                  max={biweeklyMax}
                  color="bg-sky-500"
                />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Net after plan:{" "}
                <span
                  className={
                    b.circulation < 0
                      ? "font-semibold text-red-600"
                      : "font-semibold text-emerald-600"
                  }
                >
                  {formatCents(b.circulation)}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Spending calendar (previous/current/next)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Track spending habits by day and compare month-to-month patterns.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {calendarYms.map((ymKey) => (
            <MonthSpendCalendar
              key={ymKey}
              yearMonth={ymKey}
              expenses={expenseByMonth.get(ymKey) ?? []}
            />
          ))}
        </div>
      </section>

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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Quick add</h2>
          <p className="mt-1 text-sm text-zinc-500">
            One form for spending, bills, envelopes, and paychecks for {yearMonth}.{" "}
            <Link href={`/expenses?ym=${yearMonth}`} className="text-emerald-600 underline">
              View all expenses
            </Link>
          </p>
          <QuickForms yearMonth={yearMonth} />
        </div>
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <p className="mt-2 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const width = Math.max(2, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="tabular-nums">{formatCents(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MonthSpendCalendar({
  yearMonth,
  expenses,
}: {
  yearMonth: string;
  expenses: ExpensePoint[];
}) {
  const monthStart = startOfMonth(parseYearMonth(yearMonth));
  const daysInMonth = getDaysInMonth(monthStart);
  const firstWeekday = getDay(monthStart);
  const dayTotals = new Map<number, number>();
  for (const exp of expenses) {
    const day = getDate(exp.spentAt);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + exp.amountCents);
  }
  const monthTotal = sumCents([...dayTotals.values()]);

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{yearMonth}</h3>
        <span className="text-xs tabular-nums text-zinc-500">{formatCents(monthTotal)}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, idx) => (
          <div key={`blank-${idx}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const spent = dayTotals.get(day) ?? 0;
          return (
            <div
              key={day}
              className={`rounded border p-1 text-center text-[10px] ${
                spent > 0
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="font-medium">{day}</div>
              <div className="truncate tabular-nums text-[9px] text-zinc-500">
                {spent > 0 ? formatCents(spent) : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
