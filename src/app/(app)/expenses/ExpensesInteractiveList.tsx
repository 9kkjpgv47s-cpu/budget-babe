"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bulkApplyCategoryRulesAction,
  bulkSyncTaxFromCategoriesAction,
  syncCategoryEnvelopesAction,
} from "@/app/actions/categories";
import {
  bulkApplyTagsToExpensesAction,
  bulkSetBudgetForExpensesAction,
  bulkSetCategoryForExpensesAction,
  reapplyMerchantRulesAction,
} from "@/app/actions/expenses";
import { ExpenseEditRow } from "./ExpenseEditRow";

export type ExpenseRowDTO = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: string;
  budgetPlanId: string | null;
  categoryId: string | null;
  categoryName: string | null;
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

export function ExpensesInteractiveList({
  yearMonth,
  searchQuery,
  expenses,
  allExpenseCount,
  plans,
  categories,
  uncategorizedCount,
  taxErr,
}: {
  yearMonth: string;
  searchQuery: string;
  expenses: ExpenseRowDTO[];
  allExpenseCount: number;
  plans: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  uncategorizedCount: number;
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
          Select rows to apply tags, category, or budget link in bulk. Categories auto-link
          envelopes and tax folders when rules match.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {uncategorizedCount > 0 ? (
            <form action={bulkApplyCategoryRulesAction}>
              <input type="hidden" name="yearMonth" value={yearMonth} />
              <button
                type="submit"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                Apply rules to {uncategorizedCount} uncategorized
              </button>
            </form>
          ) : null}
          <form action={syncCategoryEnvelopesAction}>
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Link categorized rows to budget envelopes
            </button>
          </form>
          <form action={reapplyMerchantRulesAction}>
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Re-run merchant rules (tags + categories)
            </button>
          </form>
          <form action={bulkSyncTaxFromCategoriesAction}>
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Sync tax folders from categories
            </button>
          </form>
        </div>
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
          <form action={bulkSetCategoryForExpensesAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <input type="hidden" name="expenseIds" value={idsCsv} />
            <select
              name="bulkCategoryId"
              required
              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              defaultValue=""
            >
              <option value="" disabled>
                Set category…
              </option>
              <option value="none">Clear category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" name="applyTaxFromCategory" defaultChecked />
              Tax folder
            </label>
            <button
              type="submit"
              className="rounded border border-zinc-400 px-3 py-1 text-xs font-medium dark:border-zinc-600"
            >
              Set category
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
          <ExpenseEditRow
            key={e.id}
            expense={e}
            yearMonth={yearMonth}
            plans={plans}
            categories={categories}
            selected={selected.has(e.id)}
            onToggle={() => toggle(e.id)}
          />
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
