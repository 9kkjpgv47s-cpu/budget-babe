import Link from "next/link";
import type { ReceiptFilter } from "./receiptFilters";

const TABS: { id: ReceiptFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "processing", label: "Reading" },
  { id: "posted", label: "Posted" },
  { id: "failed", label: "Failed" },
];

export function ReceiptFilterTabs({
  yearMonth,
  active,
  counts,
  query,
}: {
  yearMonth: string;
  active: ReceiptFilter;
  counts: Record<ReceiptFilter, number>;
  query: string;
}) {
  const qParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";

  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const selected = active === tab.id;
        const count = counts[tab.id];
        return (
          <Link
            key={tab.id}
            href={`/receipts?ym=${yearMonth}&filter=${tab.id}${qParam}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selected
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
            {count > 0 ? (
              <span className={selected ? "opacity-90" : "text-zinc-500"}>
                {" "}
                ({count})
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
