"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bulkApplyTagsToExpensesAction,
  bulkSetBudgetForExpensesAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { formatCents } from "@/lib/money";
import { ExpenseTaxApplicabilityForm } from "../tax/ExpenseTaxApplicabilityForm";

export type ExpenseRowDTO = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: string;
  budgetPlanId: string | null;
  tagsJson: string | null;
  splitGroupId: string | null;
  userName: string | null;
  receiptId: string | null;
  taxApplicability: string | null;
  taxCodeRefId: string | null;
  taxCategory: string | null;
  taxNote: string | null;
  taxReviewedAt: string | null;
};

function parseTagsDisplay(raw: string | null): string {
  if (!raw) return "";
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return "";
    return v.filter((x): x is string => typeof x === "string").join(", ");
  } catch {
    return "";
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExpensesInteractiveList({
  yearMonth,
  searchQuery,
  expenses,
  allExpenseCount,
  plans,
  taxErr,
}: {
  yearMonth: string;
  searchQuery: string;
  expenses: ExpenseRowDTO[];
  allExpenseCount: number;
  plans: { id: string; name: string }[];
  taxErr?: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const idsCsv = useMemo(() => [...selected].join(","), [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All expenses</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select rows to apply tags or a budget link in bulk. Edit or delete individually below.
        </p>
        {taxErr ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {taxErr}
          </p>
        ) : null}
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${yearMonth}`} className="text-emerald-600 underline">
            ← Overview ({yearMonth})
          </Link>
          {" · "}
          <Link href="/import" className="text-emerald-600 underline">
            Import
          </Link>
        </p>
        <form method="get" action="/expenses" className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="ym" value={yearMonth} />
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search description or payee"
            className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Search
          </button>
          {searchQuery ? (
            <Link
              href={`/expenses?ym=${yearMonth}`}
              className="self-center text-sm text-zinc-500 underline"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-2 z-10 space-y-3 rounded-xl border border-amber-200 bg-amber-50/95 p-4 text-sm shadow-sm dark:border-amber-900/50 dark:bg-amber-950/90">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            {selected.size} selected
          </p>
          <form action={bulkApplyTagsToExpensesAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <input type="hidden" name="expenseIds" value={idsCsv} />
            <input
              name="tags"
              placeholder="tags, comma-separated"
              className="min-w-[10rem] flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" name="tagMode" value="append" defaultChecked />
              Append
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" name="tagMode" value="replace" />
              Replace
            </label>
            <button
              type="submit"
              className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white dark:bg-amber-600"
            >
              Apply tags
            </button>
          </form>
          <form action={bulkSetBudgetForExpensesAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <input type="hidden" name="expenseIds" value={idsCsv} />
            <select
              name="bulkBudgetPlanId"
              required
              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              defaultValue=""
            >
              <option value="" disabled>
                Set budget…
              </option>
              <option value="none">Clear budget link</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded border border-zinc-400 px-3 py-1 text-xs font-medium dark:border-zinc-600"
            >
              Set budget
            </button>
          </form>
        </div>
      ) : null}

      <ul className="space-y-4">
        {expenses.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  className="rounded border-zinc-300"
                />
                Select
              </label>
              <span className="text-xs text-zinc-500">{new Date(e.spentAt).toLocaleString()}</span>
              <span>{e.userName}</span>
              <span className="ml-auto tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                {formatCents(e.amountCents)}
              </span>
            </div>
            {e.splitGroupId ? (
              <p className="mb-2 text-xs text-zinc-400">Split: {e.splitGroupId}</p>
            ) : null}
            <form action={updateExpenseAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="yearMonth" value={yearMonth} />
              <input
                name="description"
                defaultValue={e.description}
                className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                name="amount"
                defaultValue={(e.amountCents / 100).toFixed(2)}
                inputMode="decimal"
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                name="spentAt"
                type="datetime-local"
                defaultValue={toLocalInput(e.spentAt)}
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <select
                name="budgetPlanId"
                defaultValue={e.budgetPlanId ?? ""}
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
              >
                <option value="">No budget link</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                name="tags"
                defaultValue={parseTagsDisplay(e.tagsJson)}
                placeholder="tags, comma"
                className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="submit"
                className="rounded bg-emerald-600 py-1 text-xs text-white sm:col-span-2"
              >
                Save changes
              </button>
            </form>
            <form action={deleteExpenseAction} className="mt-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="yearMonth" value={yearMonth} />
              <button
                type="submit"
                className="text-xs text-red-600 underline hover:no-underline"
              >
                Delete
              </button>
            </form>
            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <ExpenseTaxApplicabilityForm
              expenseId={e.id}
              taxYear={new Date(e.spentAt).getFullYear()}
              yearMonth={yearMonth}
              initialApplicability={e.taxApplicability}
              initialCodeRef={e.taxCodeRefId}
              initialCategory={e.taxCategory}
              initialNote={e.taxNote}
              receiptId={e.receiptId}
              taxReviewedAt={e.taxReviewedAt}
              compact
            />
            </div>
          </li>
        ))}
      </ul>
      {expenses.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {searchQuery && allExpenseCount > 0
            ? "No expenses match your search."
            : "No expenses this month."}
        </p>
      ) : null}
    </div>
  );
}
