"use client";

import { useActionState } from "react";
import { quickPostReceiptTotalAction } from "@/app/actions/receipts";
import { formatCents } from "@/lib/money";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptQuickPostButton({
  receiptId,
  yearMonth,
  totalCents,
  descriptionHint,
}: {
  receiptId: string;
  yearMonth: string;
  totalCents: number;
  descriptionHint: string;
}) {
  const [state, action, pending] = useActionState(
    quickPostReceiptTotalAction,
    initialFormState,
  );

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="receiptId" value={receiptId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending
          ? "Posting…"
          : `Quick post ${formatCents(totalCents)} — ${descriptionHint.slice(0, 40)}${descriptionHint.length > 40 ? "…" : ""}`}
      </button>
      {state?.error ? (
        <p className="mt-1 text-[11px] text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
          {state.message ?? "Posted."}{" "}
          <a href={`/expenses?ym=${yearMonth}`} className="underline">
            View spending
          </a>
        </p>
      ) : null}
    </form>
  );
}
