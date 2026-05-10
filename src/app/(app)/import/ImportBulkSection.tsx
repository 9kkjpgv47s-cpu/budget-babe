"use client";

import { useActionState, useMemo, useState } from "react";
import {
  importCsvExpensesAction,
  importOfxExpensesAction,
  importQifExpensesAction,
} from "@/app/actions/import";
import { createSplitExpensesAction } from "@/app/actions/splitExpenses";
import { initialFormState } from "@/lib/formActionState";

export function ImportBulkSection({
  yearMonth,
  budgetPlans,
}: {
  yearMonth: string;
  budgetPlans: { id: string; name: string }[];
}) {
  const [csvState, csvAction, csvPending] = useActionState(
    importCsvExpensesAction,
    initialFormState,
  );
  const [ofxState, ofxAction, ofxPending] = useActionState(
    importOfxExpensesAction,
    initialFormState,
  );
  const [qifState, qifAction, qifPending] = useActionState(
    importQifExpensesAction,
    initialFormState,
  );
  const [splitState, splitAction, splitPending] = useActionState(
    createSplitExpensesAction,
    initialFormState,
  );

  const [dateCol, setDateCol] = useState("");
  const [amtCol, setAmtCol] = useState("");
  const [descCol, setDescCol] = useState("");

  const columnMapJson = useMemo(() => {
    const o: Record<string, number> = {};
    const d = Number.parseInt(dateCol, 10);
    const a = Number.parseInt(amtCol, 10);
    const x = Number.parseInt(descCol, 10);
    if (Number.isFinite(d) && d >= 0) o.date = d;
    if (Number.isFinite(a) && a >= 0) o.amount = a;
    if (Number.isFinite(x) && x >= 0) o.description = x;
    return Object.keys(o).length ? JSON.stringify(o) : "";
  }, [dateCol, amtCol, descCol]);

  const [splitLines, setSplitLines] = useState([
    { amount: "", description: "" },
    { amount: "", description: "" },
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">CSV import</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Optional: set 0-based column numbers if headers are not recognized.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1">
            Date col #
            <input
              value={dateCol}
              onChange={(e) => setDateCol(e.target.value)}
              className="w-12 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex items-center gap-1">
            Amount col #
            <input
              value={amtCol}
              onChange={(e) => setAmtCol(e.target.value)}
              className="w-12 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex items-center gap-1">
            Desc col #
            <input
              value={descCol}
              onChange={(e) => setDescCol(e.target.value)}
              className="w-12 rounded border border-zinc-300 px-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
        <form action={csvAction} className="mt-4 space-y-3">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input type="hidden" name="columnMapJson" value={columnMapJson} />
          {csvState?.error ? (
            <p className="text-sm text-red-600">{csvState.error}</p>
          ) : null}
          {csvState?.message ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {csvState.message}
            </p>
          ) : null}
          <textarea
            name="csvText"
            rows={8}
            placeholder="Header row then data..."
            className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={csvPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {csvPending ? "Importing…" : "Import CSV"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">OFX / QFX paste</h2>
        <form action={ofxAction} className="mt-3 space-y-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          {ofxState?.error ? (
            <p className="text-sm text-red-600">{ofxState.error}</p>
          ) : null}
          {ofxState?.message ? (
            <p className="text-sm text-emerald-700">{ofxState.message}</p>
          ) : null}
          <textarea
            name="ofxText"
            rows={8}
            className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={ofxPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {ofxPending ? "…" : "Import OFX"}
          </button>
        </form>
        <form action={qifAction} className="mt-6 space-y-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          {qifState?.error ? (
            <p className="text-sm text-red-600">{qifState.error}</p>
          ) : null}
          {qifState?.message ? (
            <p className="text-sm text-emerald-700">{qifState.message}</p>
          ) : null}
          <textarea
            name="qifText"
            rows={8}
            placeholder="!Type:Bank …"
            className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={qifPending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            {qifPending ? "…" : "Import QIF"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Split one purchase across lines</h2>
        <p className="mt-1 text-xs text-zinc-500">
          All lines share one split group id. Optional shared budget link.
        </p>
        <form action={splitAction} className="mt-4 space-y-3">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input
            type="hidden"
            name="linesJson"
            value={JSON.stringify(
              splitLines
                .map((l) => ({
                  amount: l.amount,
                  description: l.description.trim(),
                }))
                .filter((l) => l.amount && l.description),
            )}
          />
          {splitState?.error ? (
            <p className="text-sm text-red-600">{splitState.error}</p>
          ) : null}
          {splitState?.message ? (
            <p className="text-sm text-emerald-700">{splitState.message}</p>
          ) : null}
          <select
            name="budgetPlanId"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            defaultValue=""
          >
            <option value="">Shared budget (optional)</option>
            {budgetPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {splitLines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={line.amount}
                onChange={(e) => {
                  const next = [...splitLines];
                  next[i] = { ...next[i], amount: e.target.value };
                  setSplitLines(next);
                }}
                placeholder="Amount"
                className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                value={line.description}
                onChange={(e) => {
                  const next = [...splitLines];
                  next[i] = { ...next[i], description: e.target.value };
                  setSplitLines(next);
                }}
                placeholder="Description"
                className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSplitLines((s) => [...s, { amount: "", description: "" }])
            }
            className="text-xs text-emerald-700 underline"
          >
            Add line
          </button>
          <button
            type="submit"
            disabled={splitPending}
            className="block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {splitPending ? "Saving…" : "Save split"}
          </button>
        </form>
      </section>
    </div>
  );
}
