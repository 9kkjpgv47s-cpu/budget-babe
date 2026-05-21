"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { quickPostReceiptTotalAction } from "@/app/actions/receipts";

const STORAGE_KEY = "receipt-auto-post-id";

export function setAutoPostReceiptId(receiptId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, receiptId);
  } catch {
    /* ignore */
  }
}

export function clearAutoPostReceiptId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * When user opted in on upload, polls OCR status and quick-posts the total when ready.
 */
export function ReceiptAutoPostWatcher({ yearMonth }: { yearMonth: string }) {
  const router = useRouter();
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (running.current) return;
      let receiptId: string | null = null;
      try {
        receiptId = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        return;
      }
      if (!receiptId) return;

      try {
        const res = await fetch(`/api/receipts/${receiptId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) {
          clearAutoPostReceiptId();
          return;
        }
        const data = (await res.json()) as {
          readyToPost?: boolean;
          ocrStatus?: string;
        };
        if (cancelled) return;
        if (data.ocrStatus === "failed" || data.ocrStatus === "skipped") {
          clearAutoPostReceiptId();
          return;
        }
        if (!data.readyToPost) return;

        running.current = true;
        const fd = new FormData();
        fd.set("receiptId", receiptId);
        fd.set("yearMonth", yearMonth);
        const result = await quickPostReceiptTotalAction(undefined, fd);
        clearAutoPostReceiptId();
        running.current = false;
        if (result.ok) {
          router.push(`/expenses?ym=${yearMonth}`);
          router.refresh();
        }
      } catch {
        running.current = false;
      }
    };

    const id = setInterval(tick, 2500);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [yearMonth, router]);

  return null;
}
