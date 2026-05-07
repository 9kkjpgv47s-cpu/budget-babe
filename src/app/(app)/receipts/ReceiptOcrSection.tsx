import { formatCents } from "@/lib/money";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";
import {
  deleteReceiptAction,
  reprocessReceiptOcrAction,
} from "@/app/actions/receipts";
import { ReceiptPostExpenseForm } from "./ReceiptPostExpenseForm";
import { ReceiptBatchExpensesForm } from "./ReceiptBatchExpensesForm";

type ReceiptRow = {
  id: string;
  filename: string;
  uploadedAt: Date;
  user: { name: string } | null;
  totalCents: number | null;
  note: string | null;
  ocrStatus: string;
  ocrError: string | null;
  ocrRawText: string | null;
  ocrParsedLines: string | null;
  ocrConfidence: number | null;
};

function statusBadge(status: string) {
  const base =
    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums";
  switch (status) {
    case "completed":
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`;
    case "processing":
    case "pending":
      return `${base} bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100`;
    case "failed":
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`;
    case "skipped":
      return `${base} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`;
    default:
      return `${base} bg-zinc-100 text-zinc-600`;
  }
}

export function ReceiptOcrSection({
  receipt,
  yearMonth,
  budgetPlans,
}: {
  receipt: ReceiptRow;
  yearMonth: string;
  budgetPlans: { id: string; name: string }[];
}) {
  let parsed: ParsedReceiptLine[] = [];
  if (receipt.ocrParsedLines) {
    try {
      parsed = JSON.parse(receipt.ocrParsedLines) as ParsedReceiptLine[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }
  }

  const linesWithAmount = parsed.filter(
    (l) => typeof l.amountCents === "number" && l.amountCents > 0,
  );

  return (
    <div className="mt-3 w-full space-y-2 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className={statusBadge(receipt.ocrStatus)}>OCR: {receipt.ocrStatus}</span>
        {receipt.ocrConfidence != null ? (
          <span className="text-zinc-500">Confidence ~{receipt.ocrConfidence}%</span>
        ) : null}
        {(receipt.ocrStatus === "failed" ||
          receipt.ocrStatus === "skipped" ||
          receipt.ocrStatus === "completed") && (
          <form action={reprocessReceiptOcrAction}>
            <input type="hidden" name="id" value={receipt.id} />
            <button
              type="submit"
              className="text-emerald-700 underline hover:no-underline dark:text-emerald-400"
            >
              Re-run OCR
            </button>
          </form>
        )}
      </div>
      {receipt.ocrError ? (
        <p className="text-amber-800 dark:text-amber-200">{receipt.ocrError}</p>
      ) : null}
      {parsed.length > 0 ? (
        <div>
          <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">
            Parsed lines (best effort)
          </p>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-zinc-100 bg-zinc-50/80 px-2 py-1 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
            {parsed.map((line, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-zinc-800 dark:text-zinc-200">
                  {line.description}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                  {line.amountCents != null ? formatCents(line.amountCents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : receipt.ocrStatus === "completed" && receipt.ocrRawText ? (
        <p className="text-zinc-500">
          No line items matched the parser. Open raw text below and adjust totals
          manually if needed.
        </p>
      ) : null}
      {receipt.ocrRawText && receipt.ocrRawText.length > 0 ? (
        <details className="rounded border border-zinc-100 dark:border-zinc-800">
          <summary className="cursor-pointer px-2 py-1 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            Raw extracted text
          </summary>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-zinc-100 p-2 text-[11px] text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            {receipt.ocrRawText}
          </pre>
        </details>
      ) : null}
      {linesWithAmount.length > 0 ? (
        <ReceiptBatchExpensesForm
          receiptId={receipt.id}
          yearMonth={yearMonth}
          lineCount={linesWithAmount.length}
        />
      ) : null}
      <ReceiptPostExpenseForm
        receiptId={receipt.id}
        yearMonth={yearMonth}
        filename={receipt.filename}
        totalCents={receipt.totalCents}
        budgetPlans={budgetPlans}
      />
    </div>
  );
}

export function ReceiptListItem({
  receipt,
  yearMonth,
  budgetPlans,
}: {
  receipt: ReceiptRow;
  yearMonth: string;
  budgetPlans: { id: string; name: string }[];
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
      <div className="min-w-0 flex-1">
        <a
          href={`/api/receipts/${receipt.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          {receipt.filename}
        </a>
        <div className="text-xs text-zinc-500">
          {receipt.uploadedAt.toLocaleString()}
          {receipt.user ? ` · ${receipt.user.name}` : ""}
        </div>
        {receipt.totalCents != null ? (
          <div className="mt-1 font-medium tabular-nums">
            {formatCents(receipt.totalCents)}
          </div>
        ) : null}
        {receipt.note ? <div className="text-zinc-600">{receipt.note}</div> : null}
        <ReceiptOcrSection receipt={receipt} yearMonth={yearMonth} budgetPlans={budgetPlans} />
      </div>
      <form action={deleteReceiptAction}>
        <input type="hidden" name="id" value={receipt.id} />
        <button
          type="submit"
          className="text-xs text-red-600 underline hover:no-underline"
        >
          Delete
        </button>
      </form>
    </li>
  );
}
