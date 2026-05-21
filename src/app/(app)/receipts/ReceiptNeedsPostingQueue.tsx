import Link from "next/link";
import { formatCents } from "@/lib/money";
import { displayFilename, ocrStatusBadgeClass, ocrStatusLabel } from "./receiptDisplay";
import { ReceiptBatchPostButton } from "./ReceiptBatchPostButton";

type QueueReceipt = {
  id: string;
  filename: string;
  totalCents: number | null;
  ocrStatus: string;
  ocrConfidence: number | null;
};

export function ReceiptNeedsPostingQueue({
  receipts,
  yearMonth,
}: {
  receipts: QueueReceipt[];
  yearMonth: string;
}) {
  const ready = receipts.filter(
    (r) => r.ocrStatus === "completed" && r.totalCents != null && r.totalCents > 0,
  );
  if (ready.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/25">
      <h2 className="font-medium text-emerald-900 dark:text-emerald-100">
        Ready to post ({ready.length})
      </h2>
      <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-100/80">
        OCR finished — open a receipt and tap Quick post, or scroll to it below.
      </p>
      <ul className="mt-3 space-y-2">
        {ready.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm dark:border-emerald-900/60 dark:bg-zinc-900"
          >
            <div className="min-w-0">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {displayFilename(r.filename)}
              </span>
              {r.totalCents != null ? (
                <span className="ml-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                  {formatCents(r.totalCents)}
                </span>
              ) : null}
              <span className={`ml-2 ${ocrStatusBadgeClass(r.ocrStatus)}`}>
                {ocrStatusLabel(r.ocrStatus)}
              </span>
            </div>
            <Link
              href={`/receipts?ym=${yearMonth}&focus=${r.id}`}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Post now →
            </Link>
          </li>
        ))}
      </ul>
      <ReceiptBatchPostButton yearMonth={yearMonth} readyCount={ready.length} />
    </section>
  );
}
