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
  type ExpenseForRollup,
} from "@/lib/budgetRollup";
import { applySuggestedRolloversAction } from "@/app/actions/rollover";
import { BudgetAddForm } from "../BudgetAddForm";
import { BudgetCopyHeader } from "../BudgetCopyHeader";
import { BudgetPlanRow } from "../BudgetPlanRow";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
}

export default async function BudgetsPage({
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

  const [budgetPlans, expenses, prevExists] = await Promise.all([
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      where: { monthlyPeriodId: period.id },
    }),
    prisma.monthlyPeriod.findUnique({ where: { yearMonth: prevYm } }),
  ]);

  const expForRollup: ExpenseForRollup[] = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    budgetPlanId: e.budgetPlanId,
    tagsJson: e.tagsJson,
  }));

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
          <p className="mt-1 text-sm text-zinc-500">
            Envelopes, copy from last month, suggested rolled-in, and quick add.
          </p>
          <p className="mt-2 text-sm">
            <Link href={`/?ym=${ym}`} className="text-emerald-600 underline">
              ← Overview ({ym})
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <a
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/budgets?ym=${prevYm}`}
          >
            ←
          </a>
          <span className="min-w-[7rem] text-center font-medium tabular-nums">{ym}</span>
          <a
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            href={`/budgets?ym=${nextYm}`}
          >
            →
          </a>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Carry-forward & copy</h2>
        <form action={applySuggestedRolloversAction} className="mt-3">
          <input type="hidden" name="yearMonth" value={ym} />
          <button
            type="submit"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          >
            Apply suggested rolled-in from {prevYm}
          </button>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
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

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">This month ({budgetPlans.length})</h2>
        {budgetRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No budget lines yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
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

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Add budget line</h2>
        <BudgetAddForm yearMonth={ym} heading={null} />
      </section>
    </div>
  );
}
