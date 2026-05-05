"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Poll server-rendered page while any receipt is still being OCR'd.
 */
export function OcrStatusPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const ticks = useRef(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      ticks.current += 1;
      router.refresh();
      if (ticks.current >= 45) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
