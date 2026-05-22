"use client";

import { useActionState } from "react";
import { createExpensesFromReceiptLinesAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptBatchExpensesForm({
  receiptId,
  yearMonth,
  lineCount,
  budgetPlans,
  categories = [],
  defaultBudgetPlanId,
  defaultCategoryId,
  postingYearMonth,
}: {
  receiptId: string;
  yearMonth: string;
  lineCount: number;
  budgetPlans: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  defaultBudgetPlanId?: string | null;
  defaultCategoryId?: string | null;
  postingYearMonth: string;
}) {
  const [state, action, pending] = useActionState(
    createExpensesFromReceiptLinesAction,
    initialFormState,
  );

  return (
    <form action={action} className="mt-2 space-y-1">
      <input type="hidden" name="receiptId" value={receiptId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <input type="hidden" name="postingYearMonth" value={postingYearMonth} />
      {categories.length > 0 ? (
        <select
          name="categoryId"
          defaultValue={defaultCategoryId ?? ""}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Category for all lines (optional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
      {budgetPlans.length > 0 ? (
        <select
          name="budgetPlanId"
          defaultValue={defaultBudgetPlanId ?? ""}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Budget for all lines (optional)</option>
          {budgetPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
        {postingYearMonth !== yearMonth ? (
          <> Posts to ledger month {postingYearMonth}.</>
        ) : null}
      </p>
      {state?.error ? <p className="text-[11px] text-red-600">{state.error}</p> : null}
      {state?.message ? (
        <p className="text-[11px] text-emerald-800 dark:text-emerald-200">{state.message}</p>
      ) : null}
    </form>
  );
}
