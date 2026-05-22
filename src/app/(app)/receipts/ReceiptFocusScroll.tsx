"use client";

import { useEffect } from "react";

function highlight(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add(
    "ring-2",
    "ring-emerald-400",
    "ring-offset-2",
    "dark:ring-emerald-600",
  );
  return window.setTimeout(() => {
    el.classList.remove(
      "ring-2",
      "ring-emerald-400",
      "ring-offset-2",
      "dark:ring-emerald-600",
    );
  }, 4000);
}

/** Scroll to `#receipt-{id}` or `#upload` when landing from redirects / Scan FAB. */
export function ReceiptFocusScroll({ focusId }: { focusId: string | null }) {
  useEffect(() => {
    let clearHighlight: (() => void) | undefined;
    const scrollUpload = () => {
      const el = document.getElementById("upload");
      if (!el) return;
      const t = highlight(el);
      clearHighlight = () => window.clearTimeout(t);
      const input = el.querySelector<HTMLInputElement>('input[type="file"]');
      input?.focus({ preventScroll: true });
    };

    if (focusId) {
      const el = document.getElementById(`receipt-${focusId}`);
      if (el) {
        const t = highlight(el);
        clearHighlight = () => window.clearTimeout(t);
      }
    } else if (window.location.hash === "#upload") {
      scrollUpload();
    }

    const onHash = () => {
      if (window.location.hash === "#upload") scrollUpload();
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      clearHighlight?.();
    };
  }, [focusId]);

  return null;
}
