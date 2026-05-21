"use client";

import { isRasterReceiptFilename } from "./receiptDisplay";

export function ReceiptThumbnail({
  receiptId,
  filename,
}: {
  receiptId: string;
  filename: string;
}) {
  if (!isRasterReceiptFilename(filename)) return null;

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
