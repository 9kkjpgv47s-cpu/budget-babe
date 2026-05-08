"use client";

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      className="mt-8 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      onClick={() => window.location.reload()}
    >
      Try again
    </button>
  );
}
