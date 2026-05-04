"use client";

import { useActionState, useState } from "react";
import { createFullTripAction } from "@/app/actions/shopping";
import { initialFormState } from "@/lib/formActionState";

type Row = { id: string };

function newRow(): Row {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
}

export function TripForm() {
  const [state, formAction, pending] = useActionState(
    createFullTripAction,
    initialFormState,
  );
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()]);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="storeName">
            Store (optional)
          </label>
          <input
            id="storeName"
            name="storeName"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="shoppedAt">
            Date
          </label>
          <input
            id="shoppedAt"
            name="shoppedAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Line items</h3>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, newRow()])}
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            Add row
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Price each</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-1">
                    <input
                      name="itemName"
                      className="w-full rounded border border-transparent px-2 py-1 hover:border-zinc-200 dark:hover:border-zinc-700"
                    />
                  </td>
                  <td className="w-20 px-2 py-1">
                    <input
                      name="itemQty"
                      type="number"
                      min={1}
                      defaultValue={1}
                      className="w-full rounded border border-transparent px-2 py-1 text-center tabular-nums hover:border-zinc-200 dark:hover:border-zinc-700"
                    />
                  </td>
                  <td className="w-32 px-2 py-1">
                    <input
                      name="itemPrice"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full rounded border border-transparent px-2 py-1 tabular-nums hover:border-zinc-200 dark:hover:border-zinc-700"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save trip"}
      </button>
    </form>
  );
}
