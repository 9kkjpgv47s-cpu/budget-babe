import Link from "next/link";
import { addMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import {
  spentForBudgetPlan,
  envelopeRemaining,
  type BudgetPlanForRollup,
} from "@/lib/budgetRollup";
import { loadExpenseRollupsForYearMonth } from "@/lib/expenseRollup";
import { applySuggestedRolloversAction } from "@/app/actions/rollover";
import { ensureDefaultCategories } from "@/lib/categories";
import { BudgetAddForm } from "../BudgetAddForm";
import { BudgetCopyHeader } from "../BudgetCopyHeader";
import { BudgetPlanRow } from "../BudgetPlanRow";
import { CategoryEnvelopePanel } from "./CategoryEnvelopePanel";
import { MonthNav } from "@/components/ui";
import { CategorySection } from "./CategorySection";
import { CategorySpendSummary } from "./CategorySpendSummary";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  await ensureDefaultCategories();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(ym);
  const prevYm = shiftYearMonth(ym, -1);
  const nextYm = shiftYearMonth(ym, 1);

  const [budgetPlans, expForRollup, prevExists, categories, expenses] =
    await Promise.all([
      prisma.budgetPlan.findMany({
        where: { monthlyPeriodId: period.id },
        orderBy: { name: "asc" },
      }),
      loadExpenseRollupsForYearMonth(ym),
      prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } }),
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { expenses: true } } },
      }),
      prisma.expense.findMany({
        where: { monthlyPeriodId: period.id },
        select: { id: true, categoryId: true, amountCents: true },
      }),
    ]);

  const categorySpendMap = new Map<
    string,
    { name: string; slug: string; count: number; totalCents: number }
  >();
  for (const e of expenses) {
    if (!e.categoryId) continue;
    const cat = categories.find((c) => c.id === e.categoryId);
    if (!cat) continue;
    const cur = categorySpendMap.get(cat.id) ?? {
      name: cat.name,
      slug: cat.slug,
      count: 0,
      totalCents: 0,
    };
    cur.count += 1;
    cur.totalCents += e.amountCents;
    categorySpendMap.set(cat.id, cur);
  }
  const categorySpendRows = [...categorySpendMap.values()];
  let uncategorizedSpend = { count: 0, totalCents: 0 };
  for (const e of expenses) {
    if (e.categoryId) continue;
    uncategorizedSpend = {
      count: uncategorizedSpend.count + 1,
      totalCents: uncategorizedSpend.totalCents + e.amountCents,
    };
  }

  const budgetRows = budgetPlans.map((p) => {
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget lines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envelopes, copy from last month, suggested rolled-in, and quick add.
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
        <h2 className="font-medium">Carry-forward & copy</h2>
        <form action={applySuggestedRolloversAction} className="mt-3">
          <input type="hidden" name="yearMonth" value={ym} />
          <button
            type="submit"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 "
          >
            Apply suggested rolled-in from {prevYm}
          </button>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            For each line that shares a name with last month, sets rolled-in to that
            month’s unused envelope balance.
          </p>
        </form>
        <BudgetCopyHeader
          yearMonth={ym}
          prevYm={prevYm}
          hasPrevPeriod={prevExists != null}
        />
      </section>

      <CategoryEnvelopePanel
        yearMonth={ym}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          budgetEnvelopeName: c.budgetEnvelopeName,
        }))}
        planNames={budgetPlans.map((p) => p.name)}
      />

      <CategorySpendSummary
        yearMonth={ym}
        rows={categorySpendRows}
        uncategorized={
          uncategorizedSpend.count > 0 ? uncategorizedSpend : undefined
        }
      />

      <section className="card p-5">
        <h2 className="font-medium">This month ({budgetPlans.length})</h2>
        {budgetRows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No budget lines yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {budgetRows.map(({ plan, spent, remaining }) => (
              <BudgetPlanRow
                key={plan.id}
                yearMonth={ym}
                plan={plan}
                spent={spent}
                remaining={remaining}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Add budget line</h2>
        <BudgetAddForm yearMonth={ym} heading={null} />
      </section>

      <CategorySection
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          matchText: c.matchText,
          budgetEnvelopeName: c.budgetEnvelopeName,
          defaultTaxCategory: c.defaultTaxCategory,
          expenseCount: c._count.expenses,
        }))}
      />
    </div>
  );
}
