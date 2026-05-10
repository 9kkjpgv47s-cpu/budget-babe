"use client";

import { useActionState } from "react";
import { addBillAction } from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";

export function BillAddForm({
  yearMonth,
  heading = "Bill",
}: {
  yearMonth: string;
  heading?: string | null;
}) {
  const [billState, addBill, billPending] = useActionState(
    addBillAction,
    initialFormState,
  );

  return (
    <div>
      {heading ? <h3 className="text-sm font-medium">{heading}</h3> : null}
      <form
        action={addBill}
        className={`grid gap-2 sm:grid-cols-3 ${heading ? "mt-2" : ""}`}
      >
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
  );
}
