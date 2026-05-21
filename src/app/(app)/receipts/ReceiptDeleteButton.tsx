"use client";

import { deleteReceiptAction } from "@/app/actions/receipts";

export function ReceiptDeleteButton({
  receiptId,
  expenseCount,
}: {
  receiptId: string;
  expenseCount: number;
}) {
  const message =
    expenseCount > 0
      ? `Delete this receipt? ${expenseCount} linked expense${expenseCount === 1 ? "" : "s"} will keep the receipt link empty (not deleted).`
      : "Delete this receipt and its stored file?";

  return (
    <form
      action={deleteReceiptAction}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={receiptId} />
      <button
        type="submit"
        className="text-xs text-red-600 underline hover:no-underline"
      >
        Delete
      </button>
    </form>
  );
}
