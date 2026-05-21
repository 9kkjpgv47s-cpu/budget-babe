"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Lightweight OCR status poll — refreshes the page only when processing finishes.
 */
export function OcrStatusPoller({
  active,
  yearMonth,
}: {
  active: boolean;
  yearMonth: string;
}) {
  const router = useRouter();
  const ticks = useRef(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (!active) {
      if (wasActive.current) {
        router.refresh();
      }
      wasActive.current = false;
      return;
    }
    wasActive.current = true;

    const id = setInterval(async () => {
      ticks.current += 1;
      try {
        const res = await fetch(
          `/api/receipts/ocr-status?ym=${encodeURIComponent(yearMonth)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { active?: boolean };
        if (!data.active) {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        /* ignore transient network errors */
      }
      if (ticks.current >= 60) clearInterval(id);
    }, 3000);

    return () => clearInterval(id);
  }, [active, yearMonth, router]);

  return null;
}
