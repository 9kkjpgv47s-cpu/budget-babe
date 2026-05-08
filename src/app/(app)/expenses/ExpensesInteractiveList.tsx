"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bulkApplyTagsToExpensesAction,
  bulkSetBudgetForExpensesAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import {
  clearExpenseTaxAction,
  markExpenseTaxReviewedAction,
  saveExpenseTaxAction,
} from "@/app/actions/tax";
import { formatCents } from "@/lib/money";
import { TAX_CATEGORY_OPTIONS } from "@/lib/taxCategories";

export type ExpenseRowDTO = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: string;
  budgetPlanId: string | null;
  tagsJson: string | null;
  splitGroupId: string | null;
  userName: string | null;
  taxQualifying: boolean;
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
}: {
  yearMonth: string;
  searchQuery: string;
  expenses: ExpenseRowDTO[];
  allExpenseCount: number;
  plans: { id: string; name: string }[];
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
              <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Tax record</p>
              {e.taxReviewedAt ? (
                <p className="mb-2 text-xs text-emerald-700 dark:text-emerald-400">
                  Reviewed {new Date(e.taxReviewedAt).toLocaleDateString()}
                </p>
              ) : e.taxQualifying ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">In tax folder — not reviewed</p>
              ) : null}
              <form action={saveExpenseTaxAction} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="expenseId" value={e.id} />
                <input type="hidden" name="taxYear" value={String(new Date(e.spentAt).getFullYear())} />
                <label className="flex items-center gap-2 text-xs sm:col-span-2">
                  <input type="checkbox" name="taxQualifying" value="on" defaultChecked={e.taxQualifying} />
                  Qualifying tax folder
                </label>
                <label className="text-xs text-zinc-500 sm:col-span-2">
                  Folder
                  <select
                    name="taxCategory"
                    defaultValue={e.taxCategory ?? "record_only"}
                    className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {TAX_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-500 sm:col-span-2">
                  Audit note
                  <textarea
                    name="taxNote"
                    rows={2}
                    defaultValue={e.taxNote ?? ""}
                    className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" className="rounded bg-zinc-800 px-2 py-1 text-xs text-white dark:bg-zinc-200 dark:text-zinc-900">
                    Save tax
                  </button>
                  <button
                    type="submit"
                    formAction={markExpenseTaxReviewedAction}
                    disabled={!e.taxQualifying}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-600"
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="submit"
                    formAction={clearExpenseTaxAction}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:text-red-300"
                  >
                    Clear tax
                  </button>
                  <Link
                    href={`/tax?year=${new Date(e.spentAt).getFullYear()}`}
                    className="self-center text-xs text-emerald-600 underline"
                  >
                    Open tax year
                  </Link>
                </div>
              </form>
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
