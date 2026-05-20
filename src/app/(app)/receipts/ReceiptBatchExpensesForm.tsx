"use client";

import { useActionState } from "react";
import { createExpensesFromReceiptLinesAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptBatchExpensesForm({
  receiptId,
  yearMonth,
  lineCount,
  budgetPlans,
  suggestedBudgetPlanId,
}: {
  receiptId: string;
  yearMonth: string;
  lineCount: number;
  budgetPlans: { id: string; name: string }[];
  suggestedBudgetPlanId?: string | null;
}) {
  const [state, action, pending] = useActionState(
    createExpensesFromReceiptLinesAction,
    initialFormState,
  );

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="receiptId" value={receiptId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />
      {budgetPlans.length > 0 ? (
        <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Budget for all lines (optional)
          </span>
          <select
            name="budgetPlanId"
            defaultValue={suggestedBudgetPlanId ?? ""}
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">No budget link</option>
            {budgetPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-emerald-600 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:bg-zinc-950 dark:hover:bg-emerald-950/40"
      >
        {pending ? "Posting…" : `Post ${lineCount} line item(s) as expenses`}
      </button>
      <p className="text-[10px] text-zinc-500">
        One split group, each line linked to this receipt. Won’t run if any expense
        already uses this receipt.
      </p>
      {state?.error ? <p className="text-[11px] text-red-600">{state.error}</p> : null}
      {state?.message ? (
        <p className="text-[11px] text-emerald-800 dark:text-emerald-200">{state.message}</p>
      ) : null}
    </form>
  );
}
