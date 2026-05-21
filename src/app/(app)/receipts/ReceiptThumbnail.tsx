"use client";

import {
  isPdfReceiptFilename,
  isRasterReceiptFilename,
} from "./receiptDisplay";

export function ReceiptThumbnail({
  receiptId,
  filename,
}: {
  receiptId: string;
  filename: string;
}) {
  if (isRasterReceiptFilename(filename)) {
    return (
      <a
        href={`/api/receipts/${receiptId}`}
        target="_blank"
        rel="noreferrer"
        className="block shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/receipts/${receiptId}`}
          alt="Receipt preview"
          className="h-24 w-24 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (isPdfReceiptFilename(filename)) {
    return (
      <a
        href={`/api/receipts/${receiptId}`}
        target="_blank"
        rel="noreferrer"
        className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-center text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
      >
        <span className="text-lg leading-none">PDF</span>
        <span className="mt-1 px-1">Open</span>
      </a>
    );
  }

  return null;
}
