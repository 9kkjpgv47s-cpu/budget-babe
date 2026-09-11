"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updateNextPaycheckAction,
  updateMonthlyNotesAction,
} from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";

export function DashboardPanel({
  yearMonth,
  nextPaycheckDate,
  monthlyNotes,
}: {
  yearMonth: string;
  nextPaycheckDate: Date | null;
  monthlyNotes: string | null;
}) {
  const [payState, savePay, payPending] = useActionState(
    updateNextPaycheckAction,
    initialFormState,
  );
  const [notesState, saveNotes, notesPending] = useActionState(
    updateMonthlyNotesAction,
    initialFormState,
  );

  const payInput =
    nextPaycheckDate != null
      ? nextPaycheckDate.toISOString().slice(0, 10)
      : "";

  return (
    <div className="mt-4 space-y-6">
      <p className="text-xs text-muted-foreground">
        Log take-home deposits under <strong>Paychecks this month</strong> below
        (or <strong>Quick add</strong> → Paycheck). Coach and overview use their
        sum as monthly income.{" "}
        <Link
          href={`/coach?ym=${yearMonth}`}
          className="font-medium text-accent underline "
        >
          Paycheck coach settings →
        </Link>
      </p>

      <form action={savePay} className="space-y-2">
        <label className="text-sm font-medium" htmlFor="nextPaycheck">
          Next paycheck date
        </label>
        <p className="text-xs text-muted-foreground">
          Unpaid bills due on or before this date count toward &quot;bills before
          next paycheck&quot;.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="nextPaycheck"
            name="nextPaycheck"
            type="date"
            defaultValue={payInput}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={payPending}
            className="btn btn-primary"
          >
            Save
          </button>
        </div>
        {payState?.error ? (
          <p className="text-sm text-red-600">{payState.error}</p>
        ) : null}
      </form>

      <form action={saveNotes} className="space-y-2">
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <label className="text-sm font-medium" htmlFor="month-notes">
          Month notes
        </label>
        <p className="text-xs text-muted-foreground">
          Private reminders for this calendar month (both users see the same text).
        </p>
        <textarea
          id="month-notes"
          name="notes"
          rows={3}
          defaultValue={monthlyNotes ?? ""}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={notesPending}
          className="btn btn-primary"
        >
          Save notes
        </button>
        {notesState?.error ? (
          <p className="text-sm text-red-600">{notesState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
