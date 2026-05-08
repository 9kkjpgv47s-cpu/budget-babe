import Link from "next/link";
import {
  clearExpenseTaxAction,
  markExpenseTaxReviewedAction,
  saveExpenseTaxAction,
} from "@/app/actions/tax";
import { formatCents } from "@/lib/money";
import { TAX_CATEGORY_OPTIONS, taxCategoryLabel } from "@/lib/taxCategories";

export type TaxFolderExpense = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: Date;
  yearMonth: string;
  payee: string | null;
  source: string;
  userName: string | null;
  taxQualifying: boolean;
  taxCategory: string | null;
  taxNote: string | null;
  taxReviewedAt: Date | null;
  reviewerName: string | null;
};

export function TaxFolderRows({ year, rows }: { year: number; rows: TaxFolderExpense[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No expenses in the qualifying folder for {year}. Use the list below to flag receipts and purchases, or edit
        from the monthly <Link href="/expenses">Expenses</Link> page.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((e) => (
        <li
          key={e.id}
          className="rounded-xl border border-emerald-200/80 bg-white p-4 dark:border-emerald-900/50 dark:bg-zinc-900/50"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{e.description}</p>
              <p className="text-xs text-zinc-500">
                {e.spentAt.toLocaleDateString()} · {e.yearMonth}
                {e.payee ? ` · ${e.payee}` : ""} · {e.source}
                {e.userName ? ` · ${e.userName}` : ""}
              </p>
            </div>
            <p className="tabular-nums text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {formatCents(e.amountCents)}
            </p>
          </div>
          {e.taxReviewedAt ? (
            <p className="mb-2 text-xs text-emerald-800 dark:text-emerald-200">
              Reviewed {e.taxReviewedAt.toLocaleString()}
              {e.reviewerName ? ` · ${e.reviewerName}` : ""}
            </p>
          ) : (
            <p className="mb-2 text-xs text-amber-800 dark:text-amber-200">Not reviewed yet</p>
          )}
          <form action={saveExpenseTaxAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="expenseId" value={e.id} />
            <input type="hidden" name="taxYear" value={String(year)} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="taxQualifying" value="on" defaultChecked={e.taxQualifying} />
              Include in tax folder (qualifying)
            </label>
            <label className="text-xs text-zinc-500 sm:col-span-2">
              Folder / category
              <select
                name="taxCategory"
                defaultValue={e.taxCategory ?? "record_only"}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                {TAX_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-500 sm:col-span-2">
              Audit note (documentation for your preparer)
              <textarea
                name="taxNote"
                rows={2}
                defaultValue={e.taxNote ?? ""}
                placeholder="e.g. HSA receipt attached in Receipts, business % estimate…"
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save record
              </button>
              <button
                type="submit"
                formAction={markExpenseTaxReviewedAction}
                disabled={!e.taxQualifying}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-600"
              >
                Mark reviewed
              </button>
              <button
                type="submit"
                formAction={clearExpenseTaxAction}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
              >
                Remove from tax folder
              </button>
            </div>
          </form>
        </li>
      ))}
    </ul>
  );
}

export function TaxCategoryTotals({
  year,
  totals,
}: {
  year: number;
  totals: { category: string; count: number; cents: number }[];
}) {
  if (totals.length === 0) {
    return <p className="text-sm text-zinc-500">No qualifying totals for {year}.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {totals.map((t) => (
        <div
          key={t.category}
          className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/60"
        >
          <p className="font-medium text-zinc-800 dark:text-zinc-100">{taxCategoryLabel(t.category)}</p>
          <p className="tabular-nums text-zinc-600 dark:text-zinc-400">
            {t.count} item{t.count === 1 ? "" : "s"} · {formatCents(t.cents)}
          </p>
        </div>
      ))}
    </div>
  );
}
