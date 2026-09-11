import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { currentYearMonth } from "@/lib/yearMonth";
import { CashFlowSiloCallout } from "@/components/CashFlowSiloCallout";
import { deleteGoalAction, deleteSpendingAdjustmentAction } from "@/app/actions/goals";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";
import { GoalForms, UpdateSavedForm } from "./GoalForms";
import { UpdateGoalForm } from "./UpdateGoalForm";
import { GoalsHouseholdContext } from "./GoalsHouseholdContext";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const goals = await prisma.savingsGoal.findMany({
    orderBy: { title: "asc" },
    include: { adjustments: { orderBy: { startsOn: "desc" } } },
  });

  const totalAdjustments = await prisma.spendingAdjustment.aggregate({
    _sum: { amountCents: true },
  });
  const adjSum = totalAdjustments._sum.amountCents ?? 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings goals</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Track targets, update balances as you move money, and list spending
          adjustments that help you get there.
        </p>
        <div className="mt-2">
          <MonthWorkflowLinks yearMonth={yearMonth} />
        </div>
      </div>

      <CashFlowSiloCallout variant="goals" yearMonth={yearMonth} />

      <GoalsHouseholdContext yearMonth={yearMonth} />

      <section className="card p-5">
        <GoalForms goals={goals.map((g) => ({ id: g.id, title: g.title }))} />
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Household adjustments (total)</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {formatCents(adjSum)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sum of all adjustment entries. Use labels you will recognize in a few
          months.
        </p>
      </section>

      <section className="space-y-4">
        {goals.map((g) => {
          const remaining = g.targetAmountCents - g.savedAmountCents;
          const pct = Math.min(
            100,
            Math.round((g.savedAmountCents / g.targetAmountCents) * 100),
          );
          return (
            <article
              key={g.id}
              className="card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{g.title}</h3>
                  {g.deadline ? (
                    <p className="text-xs text-muted-foreground">
                      Target date {g.deadline.toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <form action={deleteGoalAction}>
                  <input type="hidden" name="goalId" value={g.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 underline hover:no-underline"
                  >
                    Delete goal
                  </button>
                </form>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm tabular-nums">
                <span>
                  Saved{" "}
                  <span className="font-medium">{formatCents(g.savedAmountCents)}</span>
                </span>
                <span>
                  Target{" "}
                  <span className="font-medium">{formatCents(g.targetAmountCents)}</span>
                </span>
                <span className={remaining > 0 ? "text-muted-foreground" : "text-accent"}>
                  {remaining > 0
                    ? `${formatCents(remaining)} to go`
                    : "Target reached"}
                </span>
              </div>
              <UpdateSavedForm goalId={g.id} savedCents={g.savedAmountCents} />
              <UpdateGoalForm
                goalId={g.id}
                title={g.title}
                targetCents={g.targetAmountCents}
                deadline={g.deadline}
              />
              {g.adjustments.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-border">
                  {g.adjustments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>
                        {a.label}{" "}
                        <span className="tabular-nums text-accent ">
                          {formatCents(a.amountCents)}
                        </span>
                      </span>
                      <form action={deleteSpendingAdjustmentAction}>
                        <input type="hidden" name="adjustmentId" value={a.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-600 underline hover:no-underline"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet — add one above.</p>
        ) : null}
      </section>
    </div>
  );
}
