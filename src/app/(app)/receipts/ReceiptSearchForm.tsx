import type { ReceiptFilter } from "./receiptFilters";

export function ReceiptSearchForm({
  yearMonth,
  filter,
  query,
}: {
  yearMonth: string;
  filter: ReceiptFilter;
  query: string;
}) {
  return (
    <form method="get" className="flex flex-wrap gap-2">
      <input type="hidden" name="ym" value={yearMonth} />
      {filter !== "all" ? (
        <input type="hidden" name="filter" value={filter} />
      ) : null}
      <input
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Search filename, note, or store…"
        className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
      >
        Search
      </button>
    </form>
  );
}
