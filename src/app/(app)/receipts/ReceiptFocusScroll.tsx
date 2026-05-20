"use client";

import { useEffect } from "react";

/** Scroll to `#receipt-{id}` when landing from upload redirect. */
export function ReceiptFocusScroll({ focusId }: { focusId: string | null }) {
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`receipt-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add(
      "ring-2",
      "ring-emerald-400",
      "ring-offset-2",
      "dark:ring-emerald-600",
    );
    const t = window.setTimeout(() => {
      el.classList.remove(
        "ring-2",
        "ring-emerald-400",
        "ring-offset-2",
        "dark:ring-emerald-600",
      );
    }, 4000);
    return () => window.clearTimeout(t);
  }, [focusId]);

  return null;
}
