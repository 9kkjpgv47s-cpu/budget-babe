import Link from "next/link";
import { formatCents } from "@/lib/money";

export function CategorySpendSummary({
  yearMonth,
  rows,
  uncategorized,
}: {
  yearMonth: string;
  rows: { name: string; slug: string; count: number; totalCents: number }[];
  uncategorized?: { count: number; totalCents: number };
}) {
  if (rows.length === 0 && !uncategorized?.count) return null;
  const sorted = [...rows].sort((a, b) => b.totalCents - a.totalCents);

  return (
    <section className="card p-5">
      <h2 className="font-medium">Spending by category</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Totals for expenses with a category assigned this month. Tap a row to filter on
        Expenses.
      </p>
      <ul className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {sorted.map((r) => (
          <li key={r.slug} className="flex items-center justify-between gap-2 py-2">
            <Link
              href={`/expenses?ym=${yearMonth}&cat=${encodeURIComponent(r.slug)}`}
              className="text-accent underline hover:no-underline "
            >
              {r.name}
              <span className="ml-2 text-xs text-muted-foreground no-underline">
                {r.count} {r.count === 1 ? "expense" : "expenses"}
              </span>
            </Link>
            <span className="tabular-nums font-medium">{formatCents(r.totalCents)}</span>
          </li>
        ))}
        {uncategorized && uncategorized.count > 0 ? (
          <li className="flex items-center justify-between gap-2 border-t border-zinc-100 py-2 dark:border-border">
            <Link
              href={`/expenses?ym=${yearMonth}&uncategorized=1`}
              className="text-amber-800 underline hover:no-underline dark:text-amber-200"
            >
              Uncategorized
              <span className="ml-2 text-xs text-muted-foreground no-underline">
                {uncategorized.count}{" "}
                {uncategorized.count === 1 ? "expense" : "expenses"}
              </span>
            </Link>
            <span className="tabular-nums font-medium">
              {formatCents(uncategorized.totalCents)}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
