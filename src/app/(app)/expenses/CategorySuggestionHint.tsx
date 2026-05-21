"use client";

import { useEffect, useState } from "react";

export function CategorySuggestionHint({
  yearMonth,
  description,
}: {
  yearMonth: string;
  description: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const q = description.trim();
    if (q.length < 3) {
      setMessage(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(
        `/api/categories/suggest?ym=${encodeURIComponent(yearMonth)}&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : { message: null }))
        .then((data: { message?: string | null }) => {
          setMessage(data.message ?? null);
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
    <p className="text-xs text-emerald-700 dark:text-emerald-300">
      Suggested: {message}
    </p>
  );
}
