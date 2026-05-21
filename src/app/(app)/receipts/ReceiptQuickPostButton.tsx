"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { quickPostReceiptTotalAction } from "@/app/actions/receipts";
import { formatCents } from "@/lib/money";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptQuickPostButton({
  receiptId,
  yearMonth,
  totalCents,
  descriptionHint,
  ocrConfidence,
}: {
  receiptId: string;
  yearMonth: string;
  totalCents: number;
  descriptionHint: string;
  ocrConfidence?: number | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    quickPostReceiptTotalAction,
    initialFormState,
  );

  useEffect(() => {
    if (!state?.ok) return;
    router.push(`/expenses?ym=${yearMonth}`);
    router.refresh();
  }, [state?.ok, yearMonth, router]);

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
      {ocrConfidence != null && ocrConfidence >= 85 ? (
        <p className="mt-1 text-[10px] text-zinc-500">
          OCR confidence ~{ocrConfidence}% — good candidate for quick post.
        </p>
      ) : null}
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
