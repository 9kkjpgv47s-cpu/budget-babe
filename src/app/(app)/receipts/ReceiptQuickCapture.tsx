"use client";

import Link from "next/link";
import { ReceiptUploadForm } from "./ReceiptUploadForm";

export function ReceiptQuickCapture({ yearMonth }: { yearMonth: string }) {
  return (
    <section className="rounded-2xl border-2 border-dashed border-emerald-400 bg-gradient-to-b from-emerald-50/80 to-white p-4 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            Scan a receipt
          </h2>
          <p className="mt-1 max-w-lg text-sm text-emerald-900/85 dark:text-emerald-100/85">
            Take a photo or pick from your gallery. We read the total and line items,
            then you post to spending in one step.
          </p>
        </div>
        <Link
          href={`/receipts?ym=${yearMonth}`}
          className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
        >
          All receipts
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-emerald-200/80 bg-white/90 p-3 dark:border-emerald-900/50 dark:bg-zinc-950/80">
        <ReceiptUploadForm yearMonth={yearMonth} />
      </div>
    </section>
  );
}
