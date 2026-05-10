"use client";

import Link from "next/link";
import { deletePaycheckAction } from "@/app/actions/monthly";
import { formatCents } from "@/lib/money";

function formatReceivedOn(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function PaychecksPanel({
  yearMonth,
  paychecks,
}: {
  yearMonth: string;
  paychecks: {
    id: string;
    amountCents: number;
    receivedOn: Date | string;
    note: string | null;
    imageFilename: string | null;
  }[];
}) {
  return (
    <div className="mt-6 space-y-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium">Paychecks this month</h3>
      {paychecks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No paychecks logged yet — use <strong>Quick add</strong> → Paycheck.
        </p>
      ) : (
        <ul className="space-y-2">
          {paychecks.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/50"
            >
              <div>
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatCents(p.amountCents)}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {formatReceivedOn(p.receivedOn)}
                </span>
                {p.note?.trim() ? (
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    {p.note}
                  </p>
                ) : null}
                {p.imageFilename ? (
                  <p className="mt-1">
                    <Link
                      href={`/api/paystubs/${p.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-600 underline dark:text-emerald-400"
                    >
                      View pay stub
                    </Link>
                  </p>
                ) : null}
              </div>
              <form action={deletePaycheckAction}>
                <input type="hidden" name="paycheckId" value={p.id} />
                <input type="hidden" name="yearMonth" value={yearMonth} />
                <button
                  type="submit"
                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {paychecks.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Monthly income in totals uses the sum of these paychecks (replacing any legacy planned income once you have entries).
        </p>
      ) : null}
    </div>
  );
}
