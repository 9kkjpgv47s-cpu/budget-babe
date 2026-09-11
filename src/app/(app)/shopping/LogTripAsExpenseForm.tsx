"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createExpenseFromShoppingTripAction } from "@/app/actions/shopping";
import { initialFormState } from "@/lib/formActionState";
import { formatCents } from "@/lib/money";

type BudgetOption = { id: string; name: string };

export function LogTripAsExpenseForm({
  tripId,
  totalCents,
  yearMonth,
  budgetPlans,
  defaultBudgetPlanId,
  existingExpense,
}: {
  tripId: string;
  totalCents: number;
  yearMonth: string;
  budgetPlans: BudgetOption[];
  defaultBudgetPlanId: string | null;
  existingExpense: { id: string; yearMonth: string } | null;
}) {
  const [state, action, pending] = useActionState(
    createExpenseFromShoppingTripAction,
    initialFormState,
  );

  if (existingExpense) {
    return (
      <p className="mt-3 text-sm text-accent ">
        Logged to monthly spending ·{" "}
        <Link
          href={`/expenses?ym=${existingExpense.yearMonth}`}
          className="font-medium underline"
        >
          View on Expenses ({existingExpense.yearMonth})
        </Link>
      </p>
    );
  }

  if (totalCents <= 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Add item prices (or a non-zero total) to log this trip as spending.
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 dark:border-border">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <div className="min-w-[10rem] flex-1">
        <label
          htmlFor={`budget-${tripId}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Post to month
        </label>
        <p className="font-mono text-sm text-foreground">{yearMonth}</p>
      </div>
      {budgetPlans.length > 0 ? (
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor={`budget-${tripId}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Budget envelope
          </label>
          <select
            id={`budget-${tripId}`}
            name="budgetPlanId"
            defaultValue={defaultBudgetPlanId ?? ""}
            className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Auto-match (groceries tag)</option>
            {budgetPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Logging…" : `Log ${formatCents(totalCents)} as expense`}
      </button>
      {state?.error ? (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="w-full text-sm text-accent ">
          {state.message}{" "}
          <Link
            href={`/expenses?ym=${yearMonth}`}
            className="font-medium underline"
          >
            Open expenses →
          </Link>
        </p>
      ) : null}
    </form>
  );
}
