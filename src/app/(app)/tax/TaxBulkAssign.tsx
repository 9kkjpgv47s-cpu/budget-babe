"use client";

import { useMemo, useState } from "react";
import { bulkQualifyTaxExpensesAction } from "@/app/actions/tax";
import { formatCents } from "@/lib/money";
import { TAX_CATEGORY_OPTIONS } from "@/lib/taxCategories";
import { isInTaxWorkpaperFolder } from "@/lib/taxCodeGuidance";

export type TaxPickRow = {
  id: string;
  description: string;
  amountCents: number;
  spentAt: string;
  yearMonth: string;
  taxApplicability: string | null;
  taxCategory: string | null;
};

export function TaxBulkAssign({ year, rows }: { year: number; rows: TaxPickRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const idsCsv = useMemo(() => [...selected].join(","), [selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const unmarked = rows.filter((r) => !isInTaxWorkpaperFolder(r.taxApplicability));

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Select expenses from {year}, then set them to <strong>Applicable</strong> with a shared preparer folder.
        Lines already marked applicable are hidden here.
      </p>
      {selected.size > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">{selected.size} selected</p>
          <form action={bulkQualifyTaxExpensesAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="taxYear" value={String(year)} />
            <input type="hidden" name="expenseIds" value={idsCsv} />
            <select
              name="taxCategory"
              required
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              defaultValue=""
            >
              <option value="" disabled>
                Choose folder…
              </option>
              {TAX_CATEGORY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white dark:bg-amber-600"
            >
              Add selected as applicable
            </button>
          </form>
        </div>
      ) : null}
      {unmarked.length === 0 ? (
        <p className="text-sm text-zinc-500">Every expense in this year is already flagged for tax, or there are no rows.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          {unmarked.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 dark:border-zinc-800"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="rounded border-zinc-300"
                />
              </label>
              <span className="text-xs text-zinc-500">{new Date(r.spentAt).toLocaleDateString()}</span>
              <span className="min-w-0 flex-1 truncate">{r.description}</span>
              <span className="text-xs text-zinc-400">{r.yearMonth}</span>
              <span className="tabular-nums font-medium">{formatCents(r.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
