import Link from "next/link";

/**
 * Cross-links for month-scoped analysis pages (Agent 4 integration strip).
 */
export function MonthWorkflowLinks({ yearMonth }: { yearMonth: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      <Link href={`/?ym=${yearMonth}`} className="text-emerald-600 underline">
        Overview ({yearMonth})
      </Link>
      <span aria-hidden>·</span>
      <Link href={`/expenses?ym=${yearMonth}`} className="text-emerald-600 underline">
        Expenses
      </Link>
      <span aria-hidden>·</span>
      <Link href={`/import?ym=${yearMonth}`} className="text-emerald-600 underline">
        Import & rules
      </Link>
      <span aria-hidden>·</span>
      <Link href={`/coach?ym=${yearMonth}`} className="text-emerald-600 underline">
        Coach
      </Link>
    </p>
  );
}
