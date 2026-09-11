import Link from "next/link";
import { addMonths, format, getDate } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import {
  parseTagsJson,
  spentForBudgetPlan,
  envelopeRemaining,
  type BudgetPlanForRollup,
} from "@/lib/budgetRollup";
import {
  buildCategoryEnvelopeLookup,
  toExpenseForRollup,
} from "@/lib/expenseRollup";
import { ensureDefaultCategories } from "@/lib/categories";
import { MonthNav, PageHeader, StackedBar } from "@/components/ui";
import { BudgetCopyHeader } from "./BudgetCopyHeader";
import { BillRow, BillsSectionHeader } from "./BillRow";
import { BudgetPlanRow } from "./BudgetPlanRow";
import { DashboardPanel } from "./DashboardPanel";
import { HomeMobileInsights } from "./HomeMobileInsights";
import { PaychecksPanel } from "./PaychecksPanel";
import {
  getLastExpenseDefaultsForYearMonth,
  sanitizeExpenseDefaultsForPlans,
} from "@/lib/entryDefaults";
import { QuickFormsSection } from "./QuickFormsSection";
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
  await ensureDefaultCategories();
  const data = await getDashboardData(yearMonth);
  const rawDefaults = await getLastExpenseDefaultsForYearMonth(yearMonth);
  const quickAddBudgetPlans = data.budgetPlans.map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, budgetEnvelopeName: true },
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const expenseDefaults = sanitizeExpenseDefaultsForPlans(
    rawDefaults,
    quickAddBudgetPlans.map((p) => p.id),
    categories.map((c) => c.id),
  );
  const lastBudgetName = expenseDefaults.budgetPlanId
    ? data.budgetPlans.find((p) => p.id === expenseDefaults.budgetPlanId)?.name
    : null;
  const lastCategoryName = expenseDefaults.categoryId
    ? categoryNameById.get(expenseDefaults.categoryId)
    : null;
  const lastTags = parseTagsJson(expenseDefaults.tagsJson);
  const hasLastEntryHint =
    lastBudgetName != null ||
    lastCategoryName != null ||
    lastTags.length > 0 ||
    expenseDefaults.payee;
  const categoryLookup = buildCategoryEnvelopeLookup(categories);
  const prevYm = shiftYearMonth(yearMonth, -1);
  const nextYm = shiftYearMonth(yearMonth, 1);
  const prevPeriodExists =
    (await prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } })) !=
    null;

  const expForRollup = data.expenses.map((e) =>
    toExpenseForRollup(
      {
        id: e.id,
        description: e.description,
        amountCents: e.amountCents,
        budgetPlanId: e.budgetPlanId,
        categoryId: e.categoryId,
        tagsJson: e.tagsJson,
      },
      categoryLookup,
    ),
  );

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

  const monthLabel = parseYearMonth(yearMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const heroSegments = [
    { label: "Spent", valueCents: data.spentTotal, color: "#065f46" },
    { label: "Bills due", valueCents: data.billsBeforePaySum, color: "#fcd34d" },
    {
      label: "Left",
      valueCents: Math.max(0, data.leftAfterUpcomingBills),
      color: "rgb(255 255 255 / 0.92)",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={monthLabel}
        subtitle="Income, spending, bills before payday, and what is left."
        actions={<MonthNav yearMonth={yearMonth} prevYm={prevYm} nextYm={nextYm} />}
      />

      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-5 text-white md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
            Left to spend
          </p>
          <p className="stat-value mt-1 text-4xl tracking-tight md:text-[2.75rem]">
            {formatCents(data.leftAfterUpcomingBills)}
          </p>
          <p className="mt-1.5 text-sm text-white/80">
            {data.nextPaycheckDate
              ? `Income minus spending and bills due before ${data.nextPaycheckDate.toLocaleDateString()}`
              : "Income minus spending and upcoming bills"}
          </p>
          <div className="mt-6">
            <StackedBar trackColor="rgb(255 255 255 / 0.25)" segments={heroSegments} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/85">
              {heroSegments.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label} · {formatCents(s.valueCents)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Income", value: formatCents(data.incomeCents) },
            { label: "Spent", value: formatCents(data.spentTotal) },
            { label: "Bills before payday", value: formatCents(data.billsBeforePaySum) },
            { label: "Left after all bills", value: formatCents(data.leftAfterAllBills) },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="stat-value mt-0.5 text-lg">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Quick add</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Spending, bills, envelopes, and paychecks for {monthLabel}.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/receipts" className="btn btn-outline">
              Receipt upload
            </Link>
            <Link href={`/expenses?ym=${yearMonth}`} className="btn btn-primary">
              Open entries
            </Link>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          {hasLastEntryHint ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Pre-filled from your last entry this month
              {lastBudgetName ? ` · Budget: ${lastBudgetName}` : ""}
              {lastCategoryName ? ` · Category: ${lastCategoryName}` : ""}
              {lastTags.length ? ` · Tags: ${lastTags.join(", ")}` : ""}
              {expenseDefaults.payee ? ` · Payee: ${expenseDefaults.payee}` : ""}
            </p>
          ) : null}
          <QuickFormsSection yearMonth={yearMonth} />
        </div>
      </section>

      <HomeMobileInsights
        trendMonths={trendMonths}
        calendarMonths={calendarMonths}
        budgetPlanOptions={budgetPlanOptions}
      />

      <section className="card card-hover p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="12" cy="12" r="0.5" fill="currentColor" />
              </svg>
            </span>
            <div>
              <h2 className="font-medium">Paycheck coach</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Savings rate (5–40%), grocery and free-spending caps, and a two-week
                bill plan after your next pay date.
              </p>
            </div>
          </div>
          <Link href={`/coach?ym=${yearMonth}`} className="btn btn-primary shrink-0">
            Open coach
          </Link>
        </div>
      </section>

      <section className="card card-hover p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M9 13h6M9 17h4" />
              </svg>
            </span>
            <div>
              <h2 className="font-medium">Tax records</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Qualifying expense folder, audit notes, review trail, and CSV export by calendar year.
              </p>
            </div>
          </div>
          <Link href={`/tax?year=${yearMonth.slice(0, 4)}`} className="btn btn-outline shrink-0">
            Open tax ({yearMonth.slice(0, 4)})
          </Link>
        </div>
      </section>

      {data.savingsGoals.length > 0 ? (
        <section className="card card-hover p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">Savings goals</h2>
                <ul className="mt-3 space-y-2.5 text-sm">
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
                      <li key={g.id} className="w-64 max-w-full">
                        <div className="flex justify-between gap-2 tabular-nums">
                          <span className="truncate">{g.title}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="progress-track mt-1">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <Link href={`/goals?ym=${yearMonth}`} className="btn btn-outline shrink-0">
              View goals
            </Link>
          </div>
        </section>
      ) : null}

      <section className="card p-4 md:p-5">
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

      <section className="card p-4 md:p-5">
        <h2 className="font-medium">Budget plans</h2>
        <p className="mt-1 text-sm">
          <Link href={`/budgets?ym=${yearMonth}`} className="text-accent underline">
            Full budgets page
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Spending matches by description, tags, or linked budget on each
          expense. Each line has a monthly limit plus optional{" "}
          <strong>rolled-in</strong> balance from last month.
        </p>
        <form action={applySuggestedRolloversAction} className="mt-3">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <button
            type="submit"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 "
          >
            Apply suggested rollovers from {prevYm}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
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
          <p className="mt-4 text-sm text-muted-foreground">No budget lines yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
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

      <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="card p-4 md:p-5">
          <h2 className="font-medium">Bills</h2>
          <p className="mt-1 text-sm">
            <Link href={`/bills?ym=${yearMonth}`} className="text-accent underline">
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
              <li className="text-muted-foreground">No bills for this month.</li>
            ) : null}
          </ul>
        </div>
        <div className="card p-4 md:p-5">
          <h2 className="font-medium">Recent expenses</h2>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {data.expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5 last:border-0"
              >
                <span className="min-w-0 truncate">
                  {e.description}
                  {e.categoryId && categoryNameById.get(e.categoryId) ? (
                    <Link
                      href={`/expenses?ym=${yearMonth}&cat=${encodeURIComponent(
                        categories.find((c) => c.id === e.categoryId)?.slug ??
                          e.categoryId,
                      )}`}
                      className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent no-underline"
                    >
                      {categoryNameById.get(e.categoryId)}
                    </Link>
                  ) : null}
                  {e.user ? (
                    <span className="ml-1 text-xs text-muted-foreground">{e.user.name}</span>
                  ) : null}
                </span>
                <span className="stat-value shrink-0 text-sm">
                  {formatCents(e.amountCents)}
                </span>
              </li>
            ))}
            {data.expenses.length === 0 ? (
              <li className="text-muted-foreground">No expenses logged.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Receipts</h2>
          <a href="/receipts" className="text-sm font-medium text-accent hover:underline">
            Manage receipts
          </a>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.receipts.map((r) => (
            <li
              key={r.id}
              className="card-hover rounded-xl border border-border p-3 text-sm"
            >
              <a
                className="font-medium text-accent hover:underline"
                href={`/api/receipts/${r.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {r.filename}
              </a>
              {r.totalCents != null ? (
                <div className="stat-value mt-0.5 text-muted-foreground">{formatCents(r.totalCents)}</div>
              ) : null}
              {r.note ? <div className="mt-0.5 text-xs text-muted-foreground">{r.note}</div> : null}
            </li>
          ))}
        </ul>
        {data.receipts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No receipts this month.</p>
        ) : null}
      </section>
    </div>
  );
}
