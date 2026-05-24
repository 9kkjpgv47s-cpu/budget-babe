"use client";

import { useState } from "react";

export function ReceiptCopyFocusLink({
  receiptId,
  yearMonth,
}: {
  receiptId: string;
  yearMonth: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="text-[10px] text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
      onClick={async () => {
        const path = `/receipts?ym=${yearMonth}&focus=${receiptId}`;
        const text =
          typeof window !== "undefined"
            ? `${window.location.origin}${path}`
            : path;
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
