"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createFullTripAction } from "@/app/actions/shopping";
import { initialFormState } from "@/lib/formActionState";
import type { PrefillLine, SuggestedItem } from "@/lib/shoppingSuggest";

export type TripRow = {
  id: string;
  name: string;
  quantity: number;
  price: string;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): TripRow {
  return { id: newId(), name: "", quantity: 1, price: "" };
}

function fromPrefill(lines: PrefillLine[]): TripRow[] {
  if (lines.length === 0) return [emptyRow(), emptyRow(), emptyRow()];
  return lines.map((l) => ({
    id: newId(),
    name: l.name,
    quantity: Math.max(1, l.quantity),
    price:
      l.priceCents != null ? (l.priceCents / 100).toFixed(2) : "",
  }));
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function mergeSuggested(rows: TripRow[], suggested: SuggestedItem[]): TripRow[] {
  const existing = new Set(
    rows.map((r) => normalize(r.name)).filter(Boolean),
  );
  const extra: TripRow[] = [];
  for (const s of suggested) {
    const key = normalize(s.name);
    if (!key || existing.has(key)) continue;
    existing.add(key);
    extra.push({
      id: newId(),
      name: s.name,
      quantity: Math.max(1, s.suggestedQty),
      price:
        s.avgPriceCents != null
          ? (s.avgPriceCents / 100).toFixed(2)
          : "",
    });
  }
  const merged = [...rows, ...extra];
  return merged.length > 0 ? merged : [emptyRow()];
}

type Props = {
  staplesPrefill: PrefillLine[];
  lastTripPrefill: PrefillLine[];
  suggestedItems: SuggestedItem[];
  /** When true (e.g. `/shopping?from=last`), form opens with last trip lines */
  startFromLast?: boolean;
};

function initialRows(
  startFromLast: boolean | undefined,
  staplesPrefill: PrefillLine[],
  lastTripPrefill: PrefillLine[],
): TripRow[] {
  if (startFromLast && lastTripPrefill.length > 0) {
    return fromPrefill(lastTripPrefill);
  }
  if (staplesPrefill.length > 0) {
    return fromPrefill(staplesPrefill);
  }
  return [emptyRow(), emptyRow(), emptyRow()];
}

export function TripForm({
  staplesPrefill,
  lastTripPrefill,
  suggestedItems,
  startFromLast,
}: Props) {
  const [state, formAction, pending] = useActionState(
    createFullTripAction,
    initialFormState,
  );
  const [rows, setRows] = useState<TripRow[]>(() =>
    initialRows(startFromLast, staplesPrefill, lastTripPrefill),
  );

  useEffect(() => {
    if (!startFromLast || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("from") !== "last") return;
    url.searchParams.delete("from");
    const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
    window.history.replaceState({}, "", next || url.pathname);
  }, [startFromLast]);

  const hasHistory = useMemo(
    () =>
      staplesPrefill.length > 0 ||
      lastTripPrefill.length > 0 ||
      suggestedItems.length > 0,
    [staplesPrefill.length, lastTripPrefill.length, suggestedItems.length],
  );

  return (
    <div className="space-y-4">
      {hasHistory ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="w-full text-xs font-medium uppercase tracking-wide text-zinc-500">
            Quick fill from history
          </span>
          <button
            type="button"
            disabled={staplesPrefill.length === 0}
            onClick={() => setRows(fromPrefill(staplesPrefill))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Items that appear on multiple recent trips, with typical qty and average price"
          >
            Usual basket
          </button>
          <button
            type="button"
            disabled={lastTripPrefill.length === 0}
            onClick={() => setRows(fromPrefill(lastTripPrefill))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Same as last trip
          </button>
          <button
            type="button"
            disabled={suggestedItems.length === 0}
            onClick={() => setRows((r) => mergeSuggested(r, suggestedItems))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            title="Append items you often buy but skipped on the last trip"
          >
            Add suggested picks
          </button>
          <button
            type="button"
            onClick={() => setRows([emptyRow(), emptyRow(), emptyRow()])}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400"
          >
            Clear to blank rows
          </button>
        </div>
      ) : null}

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
              onClick={() => setRows((r) => [...r, emptyRow()])}
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
                  <tr
                    key={row.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-2 py-1">
                      <input
                        name="itemName"
                        value={row.name}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="w-full rounded border border-transparent px-2 py-1 hover:border-zinc-200 dark:hover:border-zinc-700"
                      />
                    </td>
                    <td className="w-20 px-2 py-1">
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
                                      Number.parseInt(e.target.value, 10) ||
                                        1,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                        className="w-full rounded border border-transparent px-2 py-1 text-center tabular-nums hover:border-zinc-200 dark:hover:border-zinc-700"
                      />
                    </td>
                    <td className="w-32 px-2 py-1">
                      <input
                        name="itemPrice"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.price}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x) =>
                              x.id === row.id
                                ? { ...x, price: e.target.value }
                                : x,
                            ),
                          )
                        }
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
    </div>
  );
}
