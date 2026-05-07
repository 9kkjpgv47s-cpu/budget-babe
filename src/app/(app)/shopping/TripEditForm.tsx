"use client";

import { useActionState, useState } from "react";
import { updateFullTripAction } from "@/app/actions/shopping";
import { initialFormState } from "@/lib/formActionState";

type TripRow = { id: string; name: string; quantity: number; price: string };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): TripRow {
  return { id: newId(), name: "", quantity: 1, price: "" };
}

type TripPayload = {
  id: string;
  storeName: string | null;
  shoppedAt: Date;
  items: { name: string; quantity: number; priceCents: number | null }[];
};

function rowsFromTrip(t: TripPayload): TripRow[] {
  if (t.items.length === 0) return [emptyRow(), emptyRow()];
  return t.items.map((it) => ({
    id: newId(),
    name: it.name,
    quantity: Math.max(1, it.quantity),
    price:
      it.priceCents != null ? (it.priceCents / 100).toFixed(2) : "",
  }));
}

export function TripEditForm({ trip }: { trip: TripPayload }) {
  const [state, formAction, pending] = useActionState(
    updateFullTripAction,
    initialFormState,
  );
  const [rows, setRows] = useState<TripRow[]>(() => rowsFromTrip(trip));
  const dateStr = trip.shoppedAt.toISOString().slice(0, 10);

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-emerald-700 dark:text-emerald-400">
        Edit trip
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="tripId" value={trip.id} />
        {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Store</label>
            <input
              name="storeName"
              defaultValue={trip.storeName ?? ""}
              className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Date</label>
            <input
              name="shoppedAt"
              type="date"
              defaultValue={dateStr}
              className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-600">Line items</span>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, emptyRow()])}
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            Add row
          </button>
        </div>
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1">Item</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-1 py-0.5">
                    <input
                      name="itemName"
                      value={row.name}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      className="w-full rounded border border-transparent px-1 py-0.5 dark:bg-zinc-950"
                    />
                  </td>
                  <td className="w-16 px-1 py-0.5">
                    <input
                      name="itemQty"
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id
                              ? {
                                  ...x,
                                  quantity: Math.max(
                                    1,
                                    Number.parseInt(e.target.value, 10) || 1,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                      className="w-full rounded border border-transparent px-1 text-center dark:bg-zinc-950"
                    />
                  </td>
                  <td className="w-24 px-1 py-0.5">
                    <input
                      name="itemPrice"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={row.price}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x) =>
                            x.id === row.id ? { ...x, price: e.target.value } : x,
                          ),
                        )
                      }
                      className="w-full rounded border border-transparent px-1 dark:bg-zinc-950"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </details>
  );
}
