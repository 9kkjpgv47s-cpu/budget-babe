import Link from "next/link";
import { addMonths, format } from "date-fns";
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
import { QuickForms } from "./QuickForms";
import { applySuggestedRolloversAction } from "@/app/actions/rollover";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Income (planned)" value={formatCents(data.period.incomeCents)} />
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Household settings</h2>
          <DashboardPanel
            yearMonth={yearMonth}
            incomeCents={data.period.incomeCents}
            nextPaycheckDate={data.nextPaycheckDate}
            monthlyNotes={data.period.notes}
          />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Quick add</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Log spending, bills, and budget buckets for {yearMonth}.{" "}
            <Link href={`/expenses?ym=${yearMonth}`} className="text-emerald-600 underline">
              View all expenses
            </Link>
          </p>
          <QuickForms
            yearMonth={yearMonth}
            budgetPlans={data.budgetPlans.map((p) => ({ id: p.id, name: p.name }))}
          />
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
