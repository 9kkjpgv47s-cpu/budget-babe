"use client";

import { useEffect, useState } from "react";

export function CategorySuggestionHint({
  yearMonth,
  description,
  onApplyCategory,
}: {
  yearMonth: string;
  description: string;
  /** When set, shows a control to apply the suggested category to the parent select. */
  onApplyCategory?: (categoryId: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const q = description.trim();
    if (q.length < 3) {
      setMessage(null);
      setCategoryId(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(
        `/api/categories/suggest?ym=${encodeURIComponent(yearMonth)}&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : { message: null }))
        .then((data: { message?: string | null; categoryId?: string | null }) => {
          setMessage(data.message ?? null);
          setCategoryId(data.categoryId ?? null);
        })
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [description, yearMonth]);

  if (!message) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
      <span>Suggested: {message}</span>
      {onApplyCategory && categoryId ? (
        <button
          type="button"
          onClick={() => onApplyCategory(categoryId)}
          className="rounded border border-emerald-600/40 px-2 py-0.5 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          Use suggestion
        </button>
      ) : null}
    </div>
  );
}
