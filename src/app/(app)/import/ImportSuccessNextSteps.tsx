"use client";

import Link from "next/link";
import type { FormActionState } from "@/lib/formActionState";

function importedCount(message: string): number {
  const m = message.match(/Imported (\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

export function ImportSuccessNextSteps({
  state,
  yearMonth,
}: {
  state: FormActionState | undefined;
  yearMonth: string;
}) {
  if (!state?.ok || !state.message) return null;
  const n = importedCount(state.message);
  if (n <= 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 ">
      <p className="font-medium">Imported {n} row{n === 1 ? "" : "s"} — next for {yearMonth}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-emerald-900/90 /85">
        <li>
          New rows already ran through merchant rules. If you add rules later, use{" "}
          <a href="#merchant-rules" className="font-medium underline">
            Apply rules to this month
          </a>
          .
        </li>
        <li>
          <Link
            href={`/expenses?ym=${yearMonth}`}
            className="font-medium underline"
          >
            Assign budget envelopes
          </Link>{" "}
          on imported lines (Plaid and CSV do not set budgets automatically).
        </li>
      </ul>
    </div>
  );
}
