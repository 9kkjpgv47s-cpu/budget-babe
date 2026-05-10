"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  TAX_APPLICABILITY_OPTIONS,
  type TaxApplicabilityId,
  guidanceForApplicability,
  defaultGuidanceId,
  resolveGuidance,
  TAX_LEGAL_DISCLAIMER,
} from "@/lib/taxCodeGuidance";
import { TAX_CATEGORY_OPTIONS } from "@/lib/taxCategories";
import {
  clearExpenseTaxAction,
  markExpenseTaxReviewedAction,
  saveExpenseTaxAction,
} from "@/app/actions/tax";

function applicabilityLabel(id: string | null): string {
  if (!id) return "Not set";
  const o = TAX_APPLICABILITY_OPTIONS.find((x) => x.id === id);
  return o?.label ?? id;
}

export function ExpenseTaxApplicabilityForm({
  expenseId,
  taxYear,
  yearMonth,
  initialApplicability,
  initialCodeRef,
  initialCategory,
  initialNote,
  receiptId,
  taxReviewedAt,
  compact,
}: {
  expenseId: string;
  taxYear: number;
  /** When editing from /expenses, pass ym so validation errors redirect back here. */
  yearMonth?: string;
  initialApplicability: string | null;
  initialCodeRef: string | null;
  initialCategory: string | null;
  initialNote: string | null;
  receiptId: string | null;
  taxReviewedAt: string | null;
  compact?: boolean;
}) {
  const [app, setApp] = useState<TaxApplicabilityId>(() => {
    if (initialApplicability === "not_applicable" || initialApplicability === "applicable" || initialApplicability === "applicable_with_documentation") {
      return initialApplicability;
    }
    return "not_applicable";
  });
  const [refId, setRefId] = useState(() => initialCodeRef ?? defaultGuidanceId(app));
  const [open, setOpen] = useState(false);

  const entries = useMemo(() => guidanceForApplicability(app), [app]);

  useEffect(() => {
    if (!entries.some((e) => e.id === refId)) {
      setRefId(defaultGuidanceId(app));
    }
  }, [app, entries, refId]);

  const activeEntry = resolveGuidance(refId);

  const docWarning =
    app === "applicable_with_documentation" && !receiptId
      ? "No receipt is linked to this expense. Add an audit note describing your supporting records (bank memo, calendar, mileage log, etc.)."
      : null;

  const pad = compact ? "text-xs" : "text-sm";

  return (
    <div className={`space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 ${pad}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Tax:</span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          {applicabilityLabel(app)}
        </span>
        {taxReviewedAt ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">Reviewed</span>
        ) : (app === "applicable" || app === "applicable_with_documentation") ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">Not reviewed</span>
        ) : null}
      </div>
      {docWarning ? <p className="text-xs text-amber-800 dark:text-amber-200">{docWarning}</p> : null}

      <form action={saveExpenseTaxAction} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="expenseId" value={expenseId} />
        <input type="hidden" name="taxYear" value={String(taxYear)} />
        <input type="hidden" name="from" value={yearMonth ? "expenses" : "tax"} />
        {yearMonth ? <input type="hidden" name="yearMonth" value={yearMonth} /> : null}

        <label className={`text-zinc-600 dark:text-zinc-400 sm:col-span-2 ${compact ? "text-xs" : "text-sm"}`}>
          Applicability
          <select
            name="taxApplicability"
            value={app}
            onChange={(e) => setApp(e.target.value as TaxApplicabilityId)}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {TAX_APPLICABILITY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`text-zinc-600 dark:text-zinc-400 sm:col-span-2 ${compact ? "text-xs" : "text-sm"}`}>
          Tax code reference (why this applies or does not)
          <select
            name="taxCodeRefId"
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="button"
            className="text-xs font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-400"
            onClick={() => setOpen(true)}
          >
            View tax guidance
          </button>
        </div>

        <label className={`text-zinc-600 dark:text-zinc-400 sm:col-span-2 ${compact ? "text-xs" : "text-sm"}`}>
          Preparer folder (optional)
          <select
            name="taxCategory"
            defaultValue={initialCategory ?? "record_only"}
            disabled={app === "not_applicable"}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {TAX_CATEGORY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`text-zinc-600 dark:text-zinc-400 sm:col-span-2 ${compact ? "text-xs" : "text-sm"}`}>
          Audit note (documentation, missing receipt, context)
          <textarea
            name="taxNote"
            rows={compact ? 2 : 3}
            defaultValue={initialNote ?? ""}
            placeholder={
              app === "applicable_with_documentation"
                ? "Describe supporting records when no official receipt is in the app…"
                : "Optional context for your preparer…"
            }
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            className={
              compact
                ? "rounded bg-zinc-800 px-2 py-1 text-xs text-white dark:bg-zinc-200 dark:text-zinc-900"
                : "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            }
          >
            Save tax record
          </button>
          <button
            type="submit"
            formAction={markExpenseTaxReviewedAction}
            disabled={app === "not_applicable"}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-600"
          >
            Mark reviewed
          </button>
          <button
            type="submit"
            formAction={clearExpenseTaxAction}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
          >
            Clear tax record
          </button>
          <Link
            href={`/tax?year=${taxYear}`}
            className="self-center text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            Open tax year
          </Link>
        </div>
      </form>

      {open && activeEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tax-guidance-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 id="tax-guidance-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {activeEntry.title}
            </h3>
            <p className="mt-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">{activeEntry.citation}</p>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{activeEntry.summary}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{activeEntry.detail}</p>
            <p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-700">{TAX_LEGAL_DISCLAIMER}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
