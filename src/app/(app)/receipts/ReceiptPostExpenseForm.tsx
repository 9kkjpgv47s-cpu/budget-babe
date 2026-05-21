"use client";

import { useActionState } from "react";
import { createExpenseFromReceiptAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptPostExpenseForm({
  receiptId,
  yearMonth,
  defaultDescription,
  totalCents,
  budgetPlans,
  suggestedBudgetPlanId,
  spentAtHint,
  payeeHint,
}: {
  receiptId: string;
  yearMonth: string;
  defaultDescription: string;
  totalCents: number | null;
  budgetPlans: { id: string; name: string }[];
  suggestedBudgetPlanId?: string | null;
  spentAtHint?: string | null;
  payeeHint?: string | null;
}) {
  const [state, action, pending] = useActionState(
    createExpenseFromReceiptAction,
    initialFormState,
  );
  const defaultAmt =
    totalCents != null && totalCents > 0 ? (totalCents / 100).toFixed(2) : "";
  const defaultDesc = defaultDescription;

  return (
    <div className="mt-3 rounded border border-emerald-200 bg-emerald-50/40 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <p className="mb-2 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
        Post as one expense (receipt total)
      </p>
      {spentAtHint || payeeHint ? (
        <p className="mb-2 text-[10px] text-zinc-600 dark:text-zinc-400">
          {payeeHint ? (
            <>
              Payee: <strong>{payeeHint}</strong>
              {spentAtHint ? " · " : null}
            </>
          ) : null}
          {spentAtHint ? (
            <>
              Date: <strong>{spentAtHint}</strong>
            </>
          ) : null}{" "}
          (applied when you post)
        </p>
      ) : null}
      <form action={action} className="grid gap-1.5 text-[11px] sm:grid-cols-2">
        <input type="hidden" name="receiptId" value={receiptId} />
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <input
          name="amount"
          placeholder="Amount (uses OCR total if empty)"
          defaultValue={defaultAmt}
          inputMode="decimal"
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="description"
          placeholder="Description"
          defaultValue={defaultDesc}
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="payee"
          placeholder="Payee (store)"
          defaultValue={payeeHint ?? ""}
          className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          name="budgetPlanId"
          className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          defaultValue={suggestedBudgetPlanId ?? ""}
        >
          <option value="">Budget (optional)</option>
          {budgetPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 rounded bg-emerald-600 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create expense"}
        </button>
        {state?.error ? (
          <p className="sm:col-span-2 text-xs text-red-600">{state.error}</p>
        ) : null}
        {state?.ok ? (
          <p className="sm:col-span-2 text-xs text-emerald-800 dark:text-emerald-200">
            Expense added — view on Overview or Expenses.
          </p>
        ) : null}
      </form>
    </div>
  );
}
