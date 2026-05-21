import { displayFilename } from "./receiptDisplay";

export type ReceiptFilter = "all" | "ready" | "processing" | "posted" | "failed";

export type ReceiptListRow = {
  id: string;
  filename: string;
  note: string | null;
  ocrStatus: string;
  totalCents: number | null;
  expenseCount: number;
};

export function parseReceiptFilter(raw: string | undefined): ReceiptFilter {
  if (
    raw === "ready" ||
    raw === "processing" ||
    raw === "posted" ||
    raw === "failed"
  ) {
    return raw;
  }
  return "all";
}

export function filterReceipts(
  receipts: ReceiptListRow[],
  filter: ReceiptFilter,
  query: string,
): ReceiptListRow[] {
  const q = query.trim().toLowerCase();
  return receipts.filter((r) => {
    if (filter === "ready") {
      if (
        r.expenseCount > 0 ||
        r.ocrStatus !== "completed" ||
        r.totalCents == null ||
        r.totalCents <= 0
      ) {
        return false;
      }
    } else if (filter === "processing") {
      if (r.ocrStatus !== "pending" && r.ocrStatus !== "processing") {
        return false;
      }
    } else if (filter === "posted") {
      if (r.expenseCount === 0) return false;
    } else if (filter === "failed") {
      if (r.ocrStatus !== "failed" && r.ocrStatus !== "skipped") return false;
    }
    if (!q) return true;
    const label = displayFilename(r.filename).toLowerCase();
    const note = (r.note ?? "").toLowerCase();
    return label.includes(q) || note.includes(q);
  });
}

export function countByFilter(receipts: ReceiptListRow[]): Record<ReceiptFilter, number> {
  return {
    all: receipts.length,
    ready: filterReceipts(receipts, "ready", "").length,
    processing: filterReceipts(receipts, "processing", "").length,
    posted: filterReceipts(receipts, "posted", "").length,
    failed: filterReceipts(receipts, "failed", "").length,
  };
}
