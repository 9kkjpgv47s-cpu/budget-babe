import Link from "next/link";
import { formatCents } from "@/lib/money";

export function CategorySpendSummary({
  yearMonth,
  rows,
}: {
  yearMonth: string;
  rows: { name: string; slug: string; count: number; totalCents: number }[];
}) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.totalCents - a.totalCents);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Spending by category</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Totals for expenses with a category assigned this month. Tap a row to filter on
        Expenses.
      </p>
      <ul className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {sorted.map((r) => (
          <li key={r.slug} className="flex items-center justify-between gap-2 py-2">
            <Link
              href={`/expenses?ym=${yearMonth}&cat=${encodeURIComponent(r.slug)}`}
              className="text-emerald-700 underline hover:no-underline dark:text-emerald-300"
            >
              {r.name}
              <span className="ml-2 text-xs text-zinc-400 no-underline">
                {r.count} {r.count === 1 ? "expense" : "expenses"}
              </span>
            </Link>
            <span className="tabular-nums font-medium">{formatCents(r.totalCents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
