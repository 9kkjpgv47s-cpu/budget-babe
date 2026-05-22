"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadReceiptAction } from "@/app/actions/receipts";
import { initialFormState } from "@/lib/formActionState";
import { compressReceiptImageIfNeeded } from "./compressReceiptImageClient";
import { setAutoPostReceiptId } from "./ReceiptAutoPostWatcher";

export function ReceiptUploadForm({
  yearMonth,
  formIdSuffix = "",
  redirectAfterUpload = false,
}: {
  yearMonth: string;
  formIdSuffix?: string;
  redirectAfterUpload?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    uploadReceiptAction,
    initialFormState,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [autoPost, setAutoPost] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileId = `receipt-file${formIdSuffix}`;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!state?.ok || !state.receiptId) return;
    if (autoPost) setAutoPostReceiptId(state.receiptId);
    if (!redirectAfterUpload) return;
    router.push(`/receipts?ym=${yearMonth}&focus=${state.receiptId}`);
    router.refresh();
  }, [redirectAfterUpload, autoPost, state, yearMonth, router]);

  function applyFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      setFileLabel(null);
      return;
    }
    setFileLabel(file.name);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const raw = fd.get("file");
    if (raw instanceof File && raw.size > 0) {
      const compressed = await compressReceiptImageIfNeeded(raw);
      fd.set("file", compressed, compressed.name);
    }
    formAction(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">{state.message}</p>
      ) : null}
      {state?.ok && !redirectAfterUpload ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          Uploaded — OCR is running. Refresh this page in a few seconds.
        </p>
      ) : null}
      {state?.ok && redirectAfterUpload ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          Uploaded — opening your receipt…
        </p>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (!file || !fileInputRef.current) return;
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInputRef.current.files = dt.files;
          applyFile(file);
        }}
        className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/40"
            : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-950/50"
        }`}
      >
        <p className="text-xs text-zinc-500">
          <strong className="text-zinc-700 dark:text-zinc-300">Drop a photo here</strong>{" "}
          or use the file picker. HEIC/iPhone photos convert to JPEG automatically. Large
        photos are compressed before upload.
        </p>
        {previewUrl ? (
          <div className="mt-3 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview before upload"
              className="max-h-40 max-w-[min(100%,14rem)] rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
            />
            {fileLabel ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{fileLabel}</p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor={fileId}>
              Receipt photo (recommended)
            </label>
            <input
              ref={fileInputRef}
              id={fileId}
              name="file"
              type="file"
              accept="image/*,image/heic,image/heif,application/pdf"
              capture="environment"
              required
              className="mt-1 block w-full text-sm"
              onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`receipt-total${formIdSuffix}`}
            >
              Total (optional)
            </label>
            <input
              id={`receipt-total${formIdSuffix}`}
              name="total"
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          className="text-sm font-medium"
          htmlFor={`receipt-note${formIdSuffix}`}
        >
          Note (optional)
        </label>
        <input
          id={`receipt-note${formIdSuffix}`}
          name="note"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={autoPost}
          onChange={(e) => setAutoPost(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Auto-post total when OCR finishes
          </strong>{" "}
          — only when confidence is OK, total is under $5,000, and no matching
          expense was posted in the last 7 days.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload receipt"}
      </button>
    </form>
  );
}
