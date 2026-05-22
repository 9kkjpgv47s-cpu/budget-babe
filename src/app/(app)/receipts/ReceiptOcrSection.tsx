import { formatCents } from "@/lib/money";
import {
  defaultExpenseDescriptionFromReceipt,
  inferSpentAtFromOcrText,
  parseMerchantFromOcrText,
  type ParsedReceiptLine,
} from "@/lib/receiptOcr";
import {
  moveReceiptToMonthAction,
  reprocessReceiptOcrAction,
} from "@/app/actions/receipts";
import { ReceiptPostExpenseForm } from "./ReceiptPostExpenseForm";
import { ReceiptBatchExpensesForm } from "./ReceiptBatchExpensesForm";
import { ReceiptQuickPostButton } from "./ReceiptQuickPostButton";
import { suggestBudgetPlanId, type BudgetPlanPick } from "./receiptBudgetSuggest";
import { evaluateReceiptPostSafety } from "./receiptPostSafety";
import { displayFilename, ocrStatusBadgeClass } from "./receiptDisplay";
import { ReceiptThumbnail } from "./ReceiptThumbnail";
import { ReceiptDeleteButton } from "./ReceiptDeleteButton";

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
  expenseCount: number;
  monthlyPeriodId: string | null;
};

export async function ReceiptOcrSection({
  receipt,
  yearMonth,
  budgetPlans,
}: {
  receipt: ReceiptRow;
  yearMonth: string;
  budgetPlans: BudgetPlanPick[];
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
  const label = displayFilename(receipt.filename);
  const spentAt =
    receipt.ocrRawText?.trim()
      ? inferSpentAtFromOcrText(receipt.ocrRawText, new Date())
      : null;
  const spentAtHint = spentAt
    ? spentAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const defaultDescription = defaultExpenseDescriptionFromReceipt(
    receipt.ocrRawText ?? "",
    parsed,
    label,
  );
  const payeeHint = parseMerchantFromOcrText(receipt.ocrRawText ?? "");
  const suggestedBudgetId = suggestBudgetPlanId(defaultDescription, budgetPlans);
  const readyForReview = receipt.ocrStatus === "completed";
  const canQuickPost =
    readyForReview &&
    receipt.expenseCount === 0 &&
    receipt.totalCents != null &&
    receipt.totalCents > 0;

  const postWarnings = canQuickPost
    ? (
        await evaluateReceiptPostSafety({
          ocrStatus: receipt.ocrStatus,
          expenseCount: receipt.expenseCount,
          totalCents: receipt.totalCents,
          ocrConfidence: receipt.ocrConfidence,
          monthlyPeriodId: receipt.monthlyPeriodId,
        })
      ).warnings
    : [];

  return (
    <div className="mt-3 w-full space-y-2 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className={ocrStatusBadgeClass(receipt.ocrStatus)}>
          OCR: {receipt.ocrStatus}
        </span>
        {receipt.expenseCount > 0 ? (
          <span className="text-zinc-500">
            {receipt.expenseCount} expense{receipt.expenseCount === 1 ? "" : "s"} linked
          </span>
        ) : null}
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

      {readyForReview ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Ready to post
          </p>
          <p className="mt-1 text-[11px] text-emerald-900/90 dark:text-emerald-100/90">
            {receipt.totalCents != null && receipt.totalCents > 0 ? (
              <>
                Total detected:{" "}
                <span className="font-medium tabular-nums">
                  {formatCents(receipt.totalCents)}
                </span>
                .{" "}
              </>
            ) : null}
            {linesWithAmount.length > 0
              ? `${linesWithAmount.length} line item(s) with amounts — post all at once or use the total below.`
              : "No line items with amounts — post using the total form below."}
            {suggestedBudgetId ? (
              <>
                {" "}
                Suggested budget envelope pre-selected from the description.
              </>
            ) : null}
          </p>
          {canQuickPost ? (
            <ReceiptQuickPostButton
              receiptId={receipt.id}
              yearMonth={yearMonth}
              totalCents={receipt.totalCents!}
              descriptionHint={defaultDescription}
              ocrConfidence={receipt.ocrConfidence}
              warnings={postWarnings}
            />
          ) : null}
        </div>
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
      {linesWithAmount.length > 0 && receipt.expenseCount === 0 ? (
        <ReceiptBatchExpensesForm
          receiptId={receipt.id}
          yearMonth={yearMonth}
          lineCount={linesWithAmount.length}
          budgetPlans={budgetPlans}
          suggestedBudgetPlanId={suggestedBudgetId}
          parsedLines={parsed}
        />
      ) : null}
      {receipt.expenseCount === 0 ? (
        <ReceiptPostExpenseForm
          receiptId={receipt.id}
          yearMonth={yearMonth}
          defaultDescription={defaultDescription}
          totalCents={receipt.totalCents}
          budgetPlans={budgetPlans}
          suggestedBudgetPlanId={suggestedBudgetId}
          spentAtHint={spentAtHint}
          payeeHint={payeeHint}
        />
      ) : (
        <p className="text-[11px] text-zinc-500">
          Expenses already linked —{" "}
          <a href={`/expenses?ym=${yearMonth}`} className="text-emerald-700 underline">
            view spending
          </a>
        </p>
      )}
    </div>
  );
}

export async function ReceiptListItem({
  receipt,
  yearMonth,
  budgetPlans,
  monthOptions,
}: {
  receipt: ReceiptRow;
  yearMonth: string;
  budgetPlans: BudgetPlanPick[];
  monthOptions: string[];
}) {
  const label = displayFilename(receipt.filename);

  return (
    <li
      id={`receipt-${receipt.id}`}
      className="scroll-mt-24 flex flex-wrap items-start justify-between gap-3 py-4 text-sm"
    >
      <ReceiptThumbnail receiptId={receipt.id} filename={receipt.filename} />
      <div className="min-w-0 flex-1">
        <a
          href={`/api/receipts/${receipt.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          {label}
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
        <form
          action={moveReceiptToMonthAction}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800"
        >
          <input type="hidden" name="receiptId" value={receipt.id} />
          <label className="flex items-center gap-1 text-zinc-500">
            <span>Month</span>
            <select
              name="targetYearMonth"
              defaultValue={yearMonth}
              className="rounded border border-zinc-200 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800"
          >
            Move receipt
          </button>
        </form>
      </div>
      <ReceiptDeleteButton
        receiptId={receipt.id}
        expenseCount={receipt.expenseCount}
      />
    </li>
  );
}
