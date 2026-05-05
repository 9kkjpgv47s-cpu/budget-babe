"use client";

import { useActionState } from "react";
import { uploadReceiptAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";

export function ReceiptUploadForm({ yearMonth }: { yearMonth: string }) {
  const [state, formAction, pending] = useActionState(
    uploadReceiptAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <p className="text-xs text-zinc-500">
        <strong className="text-zinc-700 dark:text-zinc-300">Tip:</strong> a clear
        photo of the receipt (camera or gallery) gives the fastest, most accurate
        OCR. PDF is optional if you already have one.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="file">
            Receipt photo (recommended)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            required
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="total">
            Total (optional)
          </label>
          <input
            id="total"
            name="total"
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="note">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload receipt"}
      </button>
    </form>
  );
}
