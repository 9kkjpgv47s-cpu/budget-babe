import { formatCents } from "@/lib/money";
import { updateBudgetPlanAction } from "@/app/actions/budgetPlan";

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
  return (
    <li className="space-y-2 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{plan.name}</span>
        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
          {formatCents(spent)} / {formatCents(cap)}
          <span className="text-xs text-zinc-500">
            {" "}
            (limit {formatCents(plan.limitCents)}
            {plan.rolledInCents > 0
              ? ` + rolled ${formatCents(plan.rolledInCents)}`
              : ""}
            )
          </span>
          <span
            className={
              remaining < 0 ? " text-red-600" : " text-emerald-600"
            }
          >
            {" "}
            ({remaining >= 0 ? "left " : "over "}
            {formatCents(Math.abs(remaining))})
          </span>
        </span>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-emerald-700 dark:text-emerald-400">
          Edit envelope
        </summary>
        <form action={updateBudgetPlanAction} className="mt-2 grid gap-1 sm:grid-cols-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input type="hidden" name="id" value={plan.id} />
          <input
            name="name"
            defaultValue={plan.name}
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="limit"
            defaultValue={(plan.limitCents / 100).toFixed(2)}
            inputMode="decimal"
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="rolledIn"
            defaultValue={(plan.rolledInCents / 100).toFixed(2)}
            inputMode="decimal"
            placeholder="Rolled in"
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="category"
            defaultValue={plan.category ?? ""}
            placeholder="Match text"
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="note"
            defaultValue={plan.note ?? ""}
            placeholder="Note"
            className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded bg-zinc-200 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            Save
          </button>
        </form>
      </details>
    </li>
  );
}
