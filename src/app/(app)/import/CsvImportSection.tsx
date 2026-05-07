"use client";

import { useActionState } from "react";
import { importCsvExpensesAction } from "@/app/actions/import";
import { initialFormState } from "@/lib/formActionState";

export function CsvImportSection({ yearMonth }: { yearMonth: string }) {
  const [state, formAction, pending] = useActionState(
    importCsvExpensesAction,
    initialFormState,
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Import expenses from CSV</h2>
      <p className="mt-1 text-xs text-zinc-500">
        First row must be headers. Recognizes: Date, Amount (or Debit/Credit),
        Description, Payee/Merchant. Amounts are treated as spending (absolute
        value).
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="yearMonth" value={yearMonth} />
        {state?.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}
        {state?.message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
        ) : null}
        <textarea
          name="csvText"
          rows={10}
          placeholder={`Date,Amount,Description
2026-01-05,42.50,COFFEE SHOP
2026-01-06,-15.00,GROCERY STORE`}
          className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import into " + yearMonth}
        </button>
      </form>
    </section>
  );
}
