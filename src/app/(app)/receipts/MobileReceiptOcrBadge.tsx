"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Amber dot on Receipts nav item while OCR is still running this month. */
export function MobileReceiptOcrBadge() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/receipts/ocr-pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setPending(typeof data.count === "number" ? data.count : 0);
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

  if (pending <= 0) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
      aria-label={`${pending} receipt(s) processing`}
    />
  );
}
