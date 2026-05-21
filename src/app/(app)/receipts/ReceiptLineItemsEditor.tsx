"use client";

import { useMemo, useState } from "react";
import type { ParsedReceiptLine } from "@/lib/receiptOcr";
import { formatCents } from "@/lib/money";

function parseMoneyInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function ReceiptLineItemsEditor({
  initialLines,
}: {
  initialLines: ParsedReceiptLine[];
}) {
  const [lines, setLines] = useState(() =>
    initialLines.map((l) => ({
      description: l.description,
      amount: l.amountCents != null ? (l.amountCents / 100).toFixed(2) : "",
    })),
  );

  const linesJson = useMemo(() => {
    const out: ParsedReceiptLine[] = [];
    for (const row of lines) {
      const desc = row.description.trim();
      const amountCents = parseMoneyInput(row.amount);
      if (!desc || amountCents == null) continue;
      out.push({ description: desc.slice(0, 500), amountCents });
    }
    return JSON.stringify(out);
  }, [lines]);

  const validCount = useMemo(() => {
    try {
      return (JSON.parse(linesJson) as ParsedReceiptLine[]).length;
    } catch {
      return 0;
    }
  }, [linesJson]);

  if (initialLines.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
        Edit line items before posting
      </p>
      <input type="hidden" name="linesJson" value={linesJson} />
      <ul className="space-y-1.5">
        {lines.map((row, i) => (
          <li key={i} className="grid gap-1 sm:grid-cols-[1fr_5rem]">
            <input
              value={row.description}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...next[i]!, description: e.target.value };
                setLines(next);
              }}
              className="rounded border border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={row.amount}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...next[i]!, amount: e.target.value };
                setLines(next);
              }}
              inputMode="decimal"
              placeholder="0.00"
              className="rounded border border-zinc-200 px-2 py-1 text-[11px] tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-zinc-500">
        {validCount} line{validCount === 1 ? "" : "s"} with amount will post
        {validCount > 0
          ? ` (${formatCents(
              (JSON.parse(linesJson) as ParsedReceiptLine[]).reduce(
                (s, l) => s + (l.amountCents ?? 0),
                0,
              ),
            )} total)`
          : null}
      </p>
    </div>
  );
}
