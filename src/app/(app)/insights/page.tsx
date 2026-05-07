import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardData";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";
import {
  expenseMatchesBudgetPlan,
  spentForBudgetPlan,
  envelopeRemaining,
  type BudgetPlanForRollup,
  type ExpenseForRollup,
} from "@/lib/budgetRollup";

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
  const data = await getDashboardData(ym);

  const expRollup: ExpenseForRollup[] = data.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    budgetPlanId: e.budgetPlanId,
    tagsJson: e.tagsJson,
  }));

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

  const uncategorized = data.expenses.filter(
    (e) => !planRollup.some((p) => expenseMatchesBudgetPlan(
      {
        id: e.id,
        description: e.description,
        amountCents: e.amountCents,
        budgetPlanId: e.budgetPlanId,
        tagsJson: e.tagsJson,
      },
      p,
    )),
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

  const maxBar = Math.max(
    1,
    ...byPlan.map((b) => Math.max(b.spent, b.cap)),
    uncSum,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spending insights</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Budget lines, uncategorized spend, and merchants that show up often
          (possible subscriptions).
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${ym}`} className="text-emerald-600 underline">
            ← Overview ({ym})
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">By budget line</h2>
        <ul className="mt-4 space-y-3">
          {byPlan.map(({ plan, spent, cap, remaining }) => {
            const pct = Math.min(100, Math.round((spent / maxBar) * 100));
            const over = spent > cap;
            return (
              <li key={plan.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{plan.name}</span>
                  <span className="tabular-nums text-zinc-600">
                    {formatCents(spent)} / {formatCents(cap)}
                    <span className="text-xs text-zinc-500">
                      {" "}
                      (limit {formatCents(plan.limitCents)}
                      {plan.rolledInCents > 0
                        ? ` + in ${formatCents(plan.rolledInCents)}`
                        : ""}
                      )
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {remaining >= 0 ? "Left" : "Over"} {formatCents(Math.abs(remaining))} in envelope
                </p>
              </li>
            );
          })}
        </ul>
        {byPlan.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No budget lines this month.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Uncategorized</h2>
        <p className="mt-1 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
          {formatCents(uncSum)} across {uncategorized.length} transactions
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Does not match any budget line by description, tag, or linked plan.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Often repeated (3+ times)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Normalized description — may indicate subscriptions or recurring stops.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {recurring.map(([label, v]) => (
            <li key={label} className="flex justify-between gap-2">
              <span className="truncate text-zinc-800 dark:text-zinc-200">
                {label}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-600">
                {v.count}× · {formatCents(v.sum)}
              </span>
            </li>
          ))}
        </ul>
        {recurring.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Need more similar transactions to detect patterns.
          </p>
        ) : null}
      </section>
    </div>
  );
}
