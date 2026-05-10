"use client";

import { useActionState } from "react";
import { addBudgetPlanAction } from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";

export function BudgetAddForm({
  yearMonth,
  heading = "Budget line",
}: {
  yearMonth: string;
  heading?: string | null;
}) {
  const [budState, addBudget, budPending] = useActionState(
    addBudgetPlanAction,
    initialFormState,
  );

  return (
    <div>
      {heading ? <h3 className="text-sm font-medium">{heading}</h3> : null}
      <form
        action={addBudget}
        className={`grid gap-2 sm:grid-cols-2 ${heading ? "mt-2" : ""}`}
      >
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <input
          name="name"
          placeholder="Groceries"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="category"
          placeholder="Match text (optional)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="limit"
          placeholder="Monthly limit"
          inputMode="decimal"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="rolledIn"
          placeholder="Rolled in (optional)"
          inputMode="decimal"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="note"
          placeholder="Note (optional)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
        />
        <button
          type="submit"
          disabled={budPending}
          className="sm:col-span-2 rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Add budget line
        </button>
        {budState?.error ? (
          <p className="sm:col-span-2 text-sm text-red-600">{budState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
