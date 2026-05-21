"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PendingPayload = {
  count?: number;
  needsPostingCount?: number;
};

/** Badge on Receipts nav: amber while OCR runs, emerald count when ready to post. */
export function MobileReceiptOcrBadge() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [needsPosting, setNeedsPosting] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/receipts/ocr-pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as PendingPayload;
        if (cancelled) return;
        setPending(typeof data.count === "number" ? data.count : 0);
        setNeedsPosting(
          typeof data.needsPostingCount === "number" ? data.needsPostingCount : 0,
        );
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  if (pending <= 0 && needsPosting <= 0) return null;

  if (needsPosting > 0 && pending <= 0) {
    return (
      <span
        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900"
        aria-label={`${needsPosting} receipt(s) ready to post`}
      >
        {needsPosting > 9 ? "9+" : needsPosting}
      </span>
    );
  }

  return (
    <span
      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
      aria-label={`${pending} receipt(s) processing`}
    />
  );
}
