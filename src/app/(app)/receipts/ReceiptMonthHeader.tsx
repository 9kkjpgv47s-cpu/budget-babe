import Link from "next/link";
import { addMonths, format } from "date-fns";
import { parseYearMonth } from "@/lib/yearMonth";

function shiftYearMonth(ym: string, delta: number) {
  return format(addMonths(parseYearMonth(ym), delta), "yyyy-MM");
}

export function ReceiptMonthHeader({ yearMonth }: { yearMonth: string }) {
  const prevYm = shiftYearMonth(yearMonth, -1);
  const nextYm = shiftYearMonth(yearMonth, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-zinc-500">
        <Link href={`/?ym=${yearMonth}`} className="text-emerald-600 underline">
          ← Overview ({yearMonth})
        </Link>
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          href={`/receipts?ym=${prevYm}`}
          aria-label="Previous month"
        >
          ←
        </Link>
        <span className="min-w-[7rem] text-center font-medium tabular-nums">
          {yearMonth}
        </span>
        <Link
          className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          href={`/receipts?ym=${nextYm}`}
          aria-label="Next month"
        >
          →
        </Link>
      </div>
    </div>
  );
}
