"use client";

import { useActionState } from "react";
import { batchReprocessFailedReceiptsAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptFailedBulkActions({
  yearMonth,
  failedCount,
}: {
  yearMonth: string;
  failedCount: number;
}) {
  const [state, action, pending] = useActionState(
    batchReprocessFailedReceiptsAction,
    initialFormState,
  );

  if (failedCount === 0) return null;

  return (
    <form action={action} className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <p className="text-sm text-amber-950 dark:text-amber-100">
        {failedCount} receipt{failedCount === 1 ? "" : "s"} failed or were skipped.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? "Re-running OCR…" : `Re-run OCR on all ${failedCount}`}
      </button>
      {state?.message ? (
        <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">{state.message}</p>
      ) : null}
      {state?.error ? (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
