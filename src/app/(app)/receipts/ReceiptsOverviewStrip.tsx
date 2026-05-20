import Link from "next/link";
import { formatCents } from "@/lib/money";
import {
  displayFilename,
  ocrStatusBadgeClass,
  ocrStatusLabel,
} from "./receiptDisplay";

type ReceiptSummary = {
  id: string;
  filename: string;
  totalCents: number | null;
  note: string | null;
  ocrStatus: string;
  _count: { expenses: number };
};

export function ReceiptsOverviewStrip({
  receipts,
  yearMonth,
}: {
  receipts: ReceiptSummary[];
  yearMonth: string;
}) {
  if (receipts.length === 0) {
    return (
      <p className="mt-2 text-sm text-zinc-500">
        No receipts this month.{" "}
        <Link href={`/receipts?ym=${yearMonth}`} className="text-emerald-600 underline">
          Scan your first receipt
        </Link>
      </p>
    );
  }

  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {receipts.map((r) => {
        const label = displayFilename(r.filename);
        const posted = r._count.expenses > 0;
        return (
          <li
            key={r.id}
            className="rounded-lg border border-zinc-100 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <a
                className="font-medium text-emerald-700 underline dark:text-emerald-400"
                href={`/api/receipts/${r.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
              <span className={ocrStatusBadgeClass(r.ocrStatus)}>
                {ocrStatusLabel(r.ocrStatus)}
              </span>
            </div>
            {r.totalCents != null ? (
              <div className="mt-1 tabular-nums text-zinc-600">
                {formatCents(r.totalCents)}
              </div>
            ) : null}
            {r.note ? <div className="text-xs text-zinc-500">{r.note}</div> : null}
            <p className="mt-2 text-xs text-zinc-500">
              {posted
                ? `${r._count.expenses} expense(s) linked`
                : r.ocrStatus === "completed"
                  ? "Ready to post"
                  : "Open to finish OCR"}
            </p>
            <Link
              href={`/receipts?ym=${yearMonth}&focus=${r.id}`}
              className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
            >
              {posted ? "View on receipts" : "Post to spending →"}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
