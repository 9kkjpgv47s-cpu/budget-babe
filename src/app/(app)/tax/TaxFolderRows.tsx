import Link from "next/link";
import { formatCents } from "@/lib/money";
import { taxCategoryLabel } from "@/lib/taxCategories";
import { ExpenseTaxApplicabilityForm } from "./ExpenseTaxApplicabilityForm";

export type TaxFolderRowModel = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: Date;
  yearMonth: string;
  payee: string | null;
  source: string;
  userName: string | null;
  receiptId: string | null;
  taxApplicability: string | null;
  taxCodeRefId: string | null;
  taxCategory: string | null;
  taxNote: string | null;
  taxReviewedAt: Date | null;
};

export function TaxFolderTable({
  year,
  rows,
}: {
  year: number;
  rows: TaxFolderRowModel[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No expenses in the tax workpaper folder for {year}. Use the list below or{" "}
        <Link href="/expenses" className="text-accent underline">
          Expenses
        </Link>{" "}
        to classify lines.
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
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-border">
            <div>
              <p className="font-medium text-foreground">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                {e.spentAt.toLocaleDateString()} · {e.yearMonth}
                {e.payee ? ` · ${e.payee}` : ""} · {e.source}
                {e.userName ? ` · ${e.userName}` : ""}
              </p>
            </div>
            <p className="tabular-nums text-sm font-semibold text-foreground">
              {formatCents(e.amountCents)}
            </p>
          </div>
          <ExpenseTaxApplicabilityForm
            expenseId={e.id}
            taxYear={year}
            initialApplicability={e.taxApplicability}
            initialCodeRef={e.taxCodeRefId}
            initialCategory={e.taxCategory}
            initialNote={e.taxNote}
            receiptId={e.receiptId}
            taxReviewedAt={e.taxReviewedAt?.toISOString() ?? null}
          />
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
    return <p className="text-sm text-muted-foreground">No folder totals for {year}.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {totals.map((t) => (
        <div
          key={t.category}
          className="rounded-lg border border-border bg-muted/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/60"
        >
          <p className="font-medium text-foreground">{taxCategoryLabel(t.category)}</p>
          <p className="tabular-nums text-muted-foreground">
            {t.count} item{t.count === 1 ? "" : "s"} · {formatCents(t.cents)}
          </p>
        </div>
      ))}
    </div>
  );
}
