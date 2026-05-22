"use client";

import Link from "next/link";

/** Mobile-only shortcut to receipt capture (sits above bottom nav). */
export function ReceiptScanFab({ yearMonth }: { yearMonth: string }) {
  return (
    <Link
      href={`/receipts?ym=${yearMonth}#upload`}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-lg ring-4 ring-emerald-600/25 transition-transform active:scale-95 md:hidden"
      aria-label="Scan a receipt"
    >
      Scan
    </Link>
  );
}
