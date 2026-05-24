"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PendingPayload = {
  count?: number;
  needsPostingCount?: number;
  yearMonth?: string;
  href?: string;
};

function badgeFor(pending: number, needsPosting: number) {
  if (needsPosting > 0 && pending <= 0) {
    return (
      <span
        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900"
        aria-hidden
      >
        {needsPosting > 9 ? "9+" : needsPosting}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span
        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
        aria-hidden
      />
    );
  }
  return null;
}

/**
 * Receipts nav entry with OCR badges and deep link to Ready filter when applicable.
 */
export function ReceiptsNavLink({
  className,
  active,
  variant = "mobile",
}: {
  className: string;
  active: boolean;
  variant?: "mobile" | "desktop";
}) {
  const pathname = usePathname();
  const [href, setHref] = useState("/receipts");
  const [pending, setPending] = useState(0);
  const [needsPosting, setNeedsPosting] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/receipts/ocr-pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as PendingPayload;
        if (cancelled) return;
        setPending(typeof data.count === "number" ? data.count : 0);
        setNeedsPosting(
          typeof data.needsPostingCount === "number" ? data.needsPostingCount : 0,
        );
        if (typeof data.href === "string" && data.href.startsWith("/receipts")) {
          setHref(data.href);
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  const ariaLabel =
    needsPosting > 0
      ? `Receipts, ${needsPosting} ready to post`
      : pending > 0
        ? `Receipts, ${pending} processing`
        : "Receipts";

  if (variant === "desktop") {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        Receipts
        {needsPosting > 0 ? (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
            {needsPosting > 9 ? "9+" : needsPosting}
          </span>
        ) : pending > 0 ? (
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={`relative ${className}`}
    >
      Receipts
      {badgeFor(pending, needsPosting)}
    </Link>
  );
}
