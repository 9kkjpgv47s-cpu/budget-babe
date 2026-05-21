const RASTER_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
]);

export function isPdfReceiptFilename(storagePath: string): boolean {
  return displayFilename(storagePath).toLowerCase().endsWith(".pdf");
}

export function isRasterReceiptFilename(storagePath: string): boolean {
  const name = displayFilename(storagePath).toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return RASTER_EXT.has(ext ?? "");
}

export function displayFilename(storagePath: string): string {
  try {
    const u = new URL(storagePath);
    const last = u.pathname.split("/").pop();
    return last || storagePath;
  } catch {
    return storagePath.split("/").pop() || storagePath;
  }
}

export function ocrStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Ready";
    case "processing":
      return "Reading…";
    case "pending":
      return "Queued";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return status;
  }
}

export function ocrStatusBadgeClass(status: string): string {
  const base =
    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums";
  switch (status) {
    case "completed":
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`;
    case "processing":
    case "pending":
      return `${base} bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100`;
    case "failed":
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`;
    case "skipped":
      return `${base} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`;
    default:
      return `${base} bg-zinc-100 text-zinc-600`;
  }
}
