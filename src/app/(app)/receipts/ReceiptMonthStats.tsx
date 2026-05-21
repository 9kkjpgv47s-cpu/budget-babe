import { formatCents } from "@/lib/money";

type StatReceipt = {
  ocrStatus: string;
  totalCents: number | null;
  expenseCount: number;
};

export function ReceiptMonthStats({ receipts }: { receipts: StatReceipt[] }) {
  const ready = receipts.filter(
    (r) =>
      r.expenseCount === 0 &&
      r.ocrStatus === "completed" &&
      r.totalCents != null &&
      r.totalCents > 0,
  );
  const processing = receipts.filter(
    (r) => r.ocrStatus === "pending" || r.ocrStatus === "processing",
  );
  const posted = receipts.filter((r) => r.expenseCount > 0);
  const readyTotal = ready.reduce((s, r) => s + (r.totalCents ?? 0), 0);

  if (receipts.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
          Ready to post
        </div>
        <div className="mt-0.5 font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
          {ready.length}
          {readyTotal > 0 ? (
            <span className="ml-1 text-xs font-normal">
              ({formatCents(readyTotal)})
            </span>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <div className="text-xs font-medium uppercase tracking-wide text-amber-900/70 dark:text-amber-100/70">
          Reading OCR
        </div>
        <div className="mt-0.5 font-semibold tabular-nums text-amber-950 dark:text-amber-100">
          {processing.length}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Linked to spending
        </div>
        <div className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {posted.length}
        </div>
      </div>
    </div>
  );
}
