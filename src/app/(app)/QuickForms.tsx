"use client";

import { useActionState } from "react";
import { addExpenseAction } from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";
import { BillAddForm } from "./BillAddForm";
import { BudgetAddForm } from "./BudgetAddForm";

export function QuickForms({
  yearMonth,
  budgetPlans,
}: {
  yearMonth: string;
  budgetPlans: { id: string; name: string }[];
}) {
  const [expState, addExpense, expPending] = useActionState(
    addExpenseAction,
    initialFormState,
  );

  return (
    <div className="mt-4 space-y-8">
      <div>
        <h3 className="text-sm font-medium">Expense</h3>
        <form action={addExpense} className="mt-2 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input
            name="description"
            placeholder="Coffee, gas, …"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="amount"
            placeholder="Amount"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            name="budgetPlanId"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            defaultValue=""
          >
            <option value="">Budget (optional)</option>
            {budgetPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="tags"
            placeholder="Tags: groceries, work (comma)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="splitGroupId"
            placeholder="Split group id (optional, same for split lines)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <button
            type="submit"
            disabled={expPending}
            className="sm:col-span-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Add expense
          </button>
          {expState?.error ? (
            <p className="sm:col-span-2 text-sm text-red-600">{expState.error}</p>
          ) : null}
        </form>
      </div>

      <BillAddForm yearMonth={yearMonth} />

      <BudgetAddForm yearMonth={yearMonth} />
    </div>
  );
}
