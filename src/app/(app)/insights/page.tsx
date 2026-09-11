import Link from "next/link";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";
import { DonutChart, EmptyState, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardData";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";
import {
  expenseMatchesBudgetPlan,
  spentForBudgetPlan,
  envelopeRemaining,
  type BudgetPlanForRollup,
} from "@/lib/budgetRollup";
import { loadExpenseRollupsForYearMonth } from "@/lib/expenseRollup";

function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .replace(/\$[\d.,]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const [data, expRollup] = await Promise.all([
    getDashboardData(ym),
    loadExpenseRollupsForYearMonth(ym),
  ]);

  const planRollup: BudgetPlanForRollup[] = data.budgetPlans.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    limitCents: p.limitCents,
    rolledInCents: p.rolledInCents,
  }));

  const byPlan = planRollup.map((p) => {
    const spent = spentForBudgetPlan(p, expRollup);
    const cap = p.rolledInCents + p.limitCents;
    const remaining = envelopeRemaining(p, spent);
    return { plan: p, spent, cap, remaining };
  });

  const uncategorized = expRollup.filter(
    (e) => !planRollup.some((p) => expenseMatchesBudgetPlan(e, p)),
  );
  const uncSum = uncategorized.reduce((s, e) => s + e.amountCents, 0);

  const freq = new Map<string, { count: number; sum: number }>();
  for (const e of data.expenses) {
    const k = normalizeMerchant(e.description);
    if (k.length < 4) continue;
    const cur = freq.get(k) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += e.amountCents;
    freq.set(k, cur);
  }
  const recurring = [...freq.entries()]
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].sum - a[1].sum)
    .slice(0, 12);

  const spentTotal = data.spentTotal;
  // Same order DonutChart renders slices — legend colors must match by index.
  const donutSegments = [
    ...byPlan.map((b) => ({ label: b.plan.name, valueCents: b.spent })),
    ...(uncSum > 0 ? [{ label: "Uncategorized", valueCents: uncSum }] : []),
  ]
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);
  const legendRows = donutSegments.slice(0, 8);
  const otherSum = donutSegments.slice(8).reduce((s, x) => s + x.valueCents, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spending insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Budget lines (including spend matched via spending categories), uncategorized
          spend, and merchants that show up often (possible subscriptions).
        </p>
        <div className="mt-2">
          <MonthWorkflowLinks yearMonth={ym} />
        </div>
      </div>

      {uncategorized.length > 0 ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {uncategorized.length} expense
          {uncategorized.length === 1 ? "" : "s"} ({formatCents(uncSum)}) not
          matched to a budget line —{" "}
          <Link
            href={`/expenses?ym=${ym}`}
            className="font-medium text-accent underline "
          >
            assign envelopes on Expenses
          </Link>
          {" "}
          or add merchant rules on Import.
        </p>
      ) : null}

      {spentTotal > 0 ? (
        <section className="card p-4 md:p-5">
          <h2 className="font-medium">Spending mix</h2>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
            <DonutChart
              segments={donutSegments}
              totalCents={spentTotal}
              centerValue={formatCents(spentTotal)}
              centerLabel="this month"
            />
            <ul className="w-full flex-1 space-y-2 text-sm">
              {legendRows.map((s, i) => (
                <li key={s.label} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: DONUT_LEGEND_COLORS[i % DONUT_LEGEND_COLORS.length] }}
                    />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="stat-value shrink-0 text-muted-foreground">
                    {formatCents(s.valueCents)}
                    <span className="ml-1.5 text-xs text-muted-foreground/70">
                      {Math.round((s.valueCents / spentTotal) * 100)}%
                    </span>
                  </span>
                </li>
              ))}
              {otherSum > 0 ? (
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                    Other
                  </span>
                  <span className="stat-value text-muted-foreground">
                    {formatCents(otherSum)}
                    <span className="ml-1.5 text-xs text-muted-foreground/70">
                      {Math.round((otherSum / spentTotal) * 100)}%
                    </span>
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="card p-4 md:p-5">
        <h2 className="font-medium">By budget line</h2>
        <ul className="mt-5 space-y-4">
          {byPlan.map(({ plan, spent, cap, remaining }) => {
            const over = spent > cap;
            return (
              <li key={plan.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{plan.name}</span>
                  <span className="stat-value text-muted-foreground">
                    {formatCents(spent)} / {formatCents(cap)}
                    <span className="text-xs text-muted-foreground/80">
                      {" "}
                      (limit {formatCents(plan.limitCents)}
                      {plan.rolledInCents > 0
                        ? ` + in ${formatCents(plan.rolledInCents)}`
                        : ""}
                      )
                    </span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={spent} max={cap} />
                </div>
                <p className={`mt-1 text-xs font-medium ${over ? "text-negative" : "text-positive"}`}>
                  {remaining >= 0 ? "Left" : "Over by"} {formatCents(Math.abs(remaining))}
                </p>
              </li>
            );
          })}
        </ul>
        {byPlan.length === 0 ? (
          <EmptyState title="No budget lines this month" hint="Create envelopes on Budgets to track spending against limits." />
        ) : null}
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="font-medium">Uncategorized</h2>
        <p className="stat-value mt-1.5 text-lg text-foreground">
          {formatCents(uncSum)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            across {uncategorized.length} transaction{uncategorized.length === 1 ? "" : "s"}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Does not match any budget line by description, tag, or linked plan.
        </p>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="font-medium">Often repeated (3+ times)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Normalized description — may indicate subscriptions or recurring stops.
        </p>
        <ul className="mt-3 space-y-2.5 text-sm">
          {recurring.map(([label, v]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span className="truncate capitalize text-foreground">
                {label}
              </span>
              <span className="stat-value shrink-0 text-muted-foreground">
                {v.count}× · {formatCents(v.sum)}
              </span>
            </li>
          ))}
        </ul>
        {recurring.length === 0 ? (
          <EmptyState
            title="No repeat merchants yet"
            hint="Patterns appear once the same merchant shows up 3+ times this month."
          />
        ) : null}
      </section>
    </div>
  );
}

const DONUT_LEGEND_COLORS = [
  "#059669", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444",
  "#14b8a6", "#6366f1", "#ec4899",
];
