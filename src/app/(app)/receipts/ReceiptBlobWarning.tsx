export function ReceiptBlobWarning() {
  if (!process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <strong className="font-semibold">Receipt storage not configured.</strong>{" "}
      Add <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">BLOB_READ_WRITE_TOKEN</code>{" "}
      in Vercel so uploaded photos persist after deploy. Without it, files on this
      host may disappear.
    </div>
  );
}
