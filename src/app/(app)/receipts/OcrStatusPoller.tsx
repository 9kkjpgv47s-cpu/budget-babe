"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 2000;
/** ~4 minutes — long PDF raster OCR can exceed the old 90s cap. */
const MAX_TICKS = 120;

/**
 * Poll server-rendered page while any receipt is still being OCR'd.
 */
export function OcrStatusPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const ticks = useRef(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) {
      ticks.current = 0;
      setTimedOut(false);
      return;
    }
    setTimedOut(false);
    ticks.current = 0;
    const id = setInterval(() => {
      ticks.current += 1;
      router.refresh();
      if (ticks.current >= MAX_TICKS) {
        clearInterval(id);
        setTimedOut(true);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [active, router]);

  if (!active && !timedOut) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
    >
      {active && !timedOut ? (
        <p>
          <span className="font-medium">Reading receipt…</span> This page refreshes
          automatically while OCR runs (photos are usually under a minute; large PDFs
          can take longer).
        </p>
      ) : timedOut ? (
        <p>
          <span className="font-medium">Still processing?</span> Refresh the page or use{" "}
          <strong>Re-run OCR</strong> on the receipt if status looks stuck.
        </p>
      ) : null}
    </div>
  );
}
