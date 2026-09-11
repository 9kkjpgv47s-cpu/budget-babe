import { formatCents } from "@/lib/money";
import { ProgressBar } from "@/components/ui";
import { deleteBudgetPlanAction, updateBudgetPlanAction } from "@/app/actions/budgetPlan";

export function BudgetPlanRow({
  yearMonth,
  plan,
  spent,
  remaining,
}: {
  yearMonth: string;
  plan: {
    id: string;
    name: string;
    category: string | null;
    limitCents: number;
    rolledInCents: number;
    note: string | null;
  };
  spent: number;
  remaining: number;
}) {
  const cap = plan.rolledInCents + plan.limitCents;
  const over = remaining < 0;
  return (
    <li className="space-y-2 border-b border-border py-3.5 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{plan.name}</span>
        <span className="stat-value text-muted-foreground">
          {formatCents(spent)} / {formatCents(cap)}
          <span className="text-xs text-muted-foreground/80">
            {" "}
            (limit {formatCents(plan.limitCents)}
            {plan.rolledInCents > 0
              ? ` + rolled ${formatCents(plan.rolledInCents)}`
              : ""}
            )
          </span>
        </span>
      </div>
      <ProgressBar value={spent} max={cap} />
      <p className={`text-xs font-medium ${over ? "text-negative" : "text-positive"}`}>
        {over ? "Over by " : "Left "}
        {formatCents(Math.abs(remaining))}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer text-accent ">
          Edit envelope
        </summary>
        <form action={updateBudgetPlanAction} className="mt-2 grid gap-1 sm:grid-cols-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input type="hidden" name="id" value={plan.id} />
          <input
            name="name"
            defaultValue={plan.name}
            className="rounded border border-border px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="limit"
            defaultValue={(plan.limitCents / 100).toFixed(2)}
            inputMode="decimal"
            className="rounded border border-border px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="rolledIn"
            defaultValue={(plan.rolledInCents / 100).toFixed(2)}
            inputMode="decimal"
            placeholder="Rolled in"
            className="rounded border border-border px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="category"
            defaultValue={plan.category ?? ""}
            placeholder="Match text"
            className="rounded border border-border px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="note"
            defaultValue={plan.note ?? ""}
            placeholder="Note"
            className="sm:col-span-2 rounded border border-border px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded bg-zinc-200 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            Save
          </button>
        </form>
        <form action={deleteBudgetPlanAction} className="mt-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input type="hidden" name="id" value={plan.id} />
          <button type="submit" className="text-xs text-red-600 underline hover:no-underline">
            Delete budget line
          </button>
        </form>
      </details>
    </li>
  );
}
