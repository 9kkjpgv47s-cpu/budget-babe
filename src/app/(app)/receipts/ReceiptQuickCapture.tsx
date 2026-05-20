"use client";

import Link from "next/link";
import { ReceiptUploadForm } from "./ReceiptUploadForm";

export function ReceiptQuickCapture({
  yearMonth,
  variant = "default",
}: {
  yearMonth: string;
  variant?: "default" | "compact";
}) {
  const isCompact = variant === "compact";

  return (
    <section
      className={
        isCompact
          ? "rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "rounded-2xl border-2 border-dashed border-emerald-400 bg-gradient-to-b from-emerald-50/80 to-white p-4 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-zinc-900"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={
              isCompact
                ? "text-sm font-semibold text-emerald-900 dark:text-emerald-100"
                : "text-base font-semibold text-emerald-900 dark:text-emerald-100"
            }
          >
            {isCompact ? "Scan receipt here" : "Scan a receipt"}
          </h2>
          <p
            className={
              isCompact
                ? "mt-0.5 text-xs text-emerald-900/85 dark:text-emerald-100/85"
                : "mt-1 max-w-lg text-sm text-emerald-900/85 dark:text-emerald-100/85"
            }
          >
            {isCompact
              ? "Upload a photo — OCR fills amount and description when you post."
              : "Take a photo or pick from your gallery. We read the total and line items, then you post to spending in one step."}
          </p>
        </div>
        <Link
          href={`/receipts?ym=${yearMonth}`}
          className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
        >
          All receipts
        </Link>
      </div>
      <div
        className={
          isCompact
            ? "mt-2"
            : "mt-4 rounded-xl border border-emerald-200/80 bg-white/90 p-3 dark:border-emerald-900/50 dark:bg-zinc-950/80"
        }
      >
        <ReceiptUploadForm
          yearMonth={yearMonth}
          formIdSuffix={isCompact ? "-compact" : "-home"}
          redirectAfterUpload={!isCompact}
        />
      </div>
    </section>
  );
}
