export function ReceiptHelpTips() {
  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <summary className="cursor-pointer px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
        Receipt tips
      </summary>
      <ul className="list-disc space-y-1.5 border-t border-zinc-200 px-6 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <li>Flat, well-lit photos beat PDF scans for speed and accuracy.</li>
        <li>Use <strong>Ready</strong> filter or the green badge on the Receipts tab when OCR finishes.</li>
        <li>
          <strong>Post all ready</strong> posts every receipt with a detected total — review on Spending
          afterward.
        </li>
        <li>
          <strong>Auto-post on upload</strong> only runs when OCR confidence, amount, and recent
          duplicates look safe (see checkbox hint).
        </li>
        <li>Line-item post lets you edit amounts before creating split expenses.</li>
        <li>Linked spending on Expenses includes links back to the original scan for tax records.</li>
      </ul>
    </details>
  );
}
