"use client";

import { useActionState } from "react";
import {
  addExpenseAction,
  addBillAction,
  addBudgetPlanAction,
} from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";

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
  const [billState, addBill, billPending] = useActionState(
    addBillAction,
    initialFormState,
  );
  const [budState, addBudget, budPending] = useActionState(
    addBudgetPlanAction,
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

      <div>
        <h3 className="text-sm font-medium">Bill</h3>
        <form action={addBill} className="mt-2 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input
            name="title"
            placeholder="Rent, electric, …"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="amount"
            placeholder="Amount"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="dueDate"
            type="date"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <button
            type="submit"
            disabled={billPending}
            className="rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add bill
          </button>
          {billState?.error ? (
            <p className="sm:col-span-3 text-sm text-red-600">{billState.error}</p>
          ) : null}
        </form>
      </div>

      <div>
        <h3 className="text-sm font-medium">Budget line</h3>
        <form action={addBudget} className="mt-2 grid gap-2 sm:grid-cols-2">
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
    </div>
  );
}
