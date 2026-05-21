"use client";

import { useActionState } from "react";
import { batchPostReadyReceiptsAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptBatchPostButton({
  yearMonth,
  readyCount,
}: {
  yearMonth: string;
  readyCount: number;
}) {
  const [state, action, pending] = useActionState(
    batchPostReadyReceiptsAction,
    initialFormState,
  );

  if (readyCount === 0) return null;

  return (
    <form action={action} className="mt-3 border-t border-emerald-200/80 pt-3 dark:border-emerald-900/60">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
      >
        {pending
          ? "Posting all…"
          : `Post all ${readyCount} ready receipt${readyCount === 1 ? "" : "s"} to spending`}
      </button>
      <p className="mt-1 text-[10px] text-emerald-900/75 dark:text-emerald-100/75">
        Uses each receipt total and store name from OCR. Skips receipts already linked.
      </p>
      {state?.error ? (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      ) : null}
      {state?.message ? (
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
          {state.message}{" "}
          <a href={`/expenses?ym=${yearMonth}`} className="underline">
            View spending
          </a>
        </p>
      ) : null}
    </form>
  );
}
