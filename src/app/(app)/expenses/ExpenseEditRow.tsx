"use client";

import { useState } from "react";
import {
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { ExpenseTaxApplicabilityForm } from "../tax/ExpenseTaxApplicabilityForm";
import { formatCents } from "@/lib/money";
import { CategorySuggestionHint } from "./CategorySuggestionHint";
import type { ExpenseRowDTO } from "./ExpensesInteractiveList";

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

export function ExpenseEditRow({
  expense: e,
  yearMonth,
  plans,
  categories,
  selected,
  onToggle,
}: {
  expense: ExpenseRowDTO;
  yearMonth: string;
  plans: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  selected: boolean;
  onToggle: () => void;
}) {
  const [description, setDescription] = useState(e.description);

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="rounded border-zinc-300"
          />
          Select
        </label>
        <span className="text-xs text-zinc-500">{new Date(e.spentAt).toLocaleString()}</span>
        {e.categoryName ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {e.categoryName}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">Uncategorized</span>
        )}
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
        <div className="sm:col-span-2 space-y-1">
          <input
            name="description"
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            className="w-full rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <CategorySuggestionHint yearMonth={yearMonth} description={description} />
        </div>
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
          name="categoryId"
          defaultValue={e.categoryId ?? ""}
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="budgetPlanId"
          defaultValue={e.budgetPlanId ?? ""}
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
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
  );
}
