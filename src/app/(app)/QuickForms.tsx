"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { unifiedQuickEntryAction } from "@/app/actions/monthly";
import { initialFormState } from "@/lib/formActionState";
import { tagsJsonToCommaList } from "@/lib/budgetRollup";

type ExpenseDefaults = {
  budgetPlanId: string | null;
  tagsJson: string | null;
  payee: string | null;
};

type EntryKind = "expense" | "bill" | "budget_line" | "paycheck";

const ENTRY_OPTIONS: { value: EntryKind; label: string }[] = [
  { value: "expense", label: "Spending (money out)" },
  { value: "bill", label: "Bill" },
  { value: "budget_line", label: "Budget envelope (new line)" },
  { value: "paycheck", label: "Paycheck (money in)" },
];

export function QuickForms({
  yearMonth,
  budgetPlans,
  expenseDefaults,
}: {
  yearMonth: string;
  budgetPlans: { id: string; name: string }[];
  expenseDefaults: ExpenseDefaults;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<EntryKind>("expense");
  const [liveDefaults, setLiveDefaults] = useState(expenseDefaults);
  const [state, action, pending] = useActionState(
    unifiedQuickEntryAction,
    initialFormState,
  );

  useEffect(() => {
    setLiveDefaults(expenseDefaults);
  }, [expenseDefaults]);

  useEffect(() => {
    if (state?.ok) {
      if (state.entryDefaults) setLiveDefaults(state.entryDefaults);
      router.refresh();
    }
  }, [state?.ok, state?.entryDefaults, router]);

  const defaultTags = tagsJsonToCommaList(liveDefaults.tagsJson);
  const defaultBudgetId =
    liveDefaults.budgetPlanId &&
    budgetPlans.some((p) => p.id === liveDefaults.budgetPlanId)
      ? liveDefaults.budgetPlanId
      : "";
  const formKey = state?.ok ? `saved-${defaultBudgetId}-${defaultTags}` : "idle";

  const submitLabel =
    kind === "expense"
      ? "Add spending"
      : kind === "bill"
        ? "Add bill"
        : kind === "budget_line"
          ? "Add budget line"
          : "Add paycheck";

  return (
    <form
      key={kind === "expense" ? formKey : kind}
      action={action}
      className="mt-4 space-y-4"
      encType="multipart/form-data"
    >
      <input type="hidden" name="yearMonth" value={yearMonth} />

      <div className="space-y-2">
        <label htmlFor="entryKind" className="text-sm font-medium">
          Entry type
        </label>
        <select
          id="entryKind"
          name="entryKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as EntryKind)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {ENTRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          {kind === "expense"
            ? "Logs a purchase for this month. Budget, tags, and payee carry from your last entry in this month."
            : kind === "bill"
              ? "Adds a bill with a due date for this month."
              : kind === "budget_line"
                ? "Creates a new envelope with a monthly spending limit."
                : "Enter take-home pay and/or attach a pay stub photo or PDF. If you only attach a file, we try to read the net amount (best-effort)."}
        </p>
      </div>

      {kind === "expense" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="description"
            placeholder="What you bought (coffee, gas, …)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="amount"
            placeholder="Amount"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="payee"
            placeholder="Payee / store (optional)"
            defaultValue={liveDefaults.payee ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            name="budgetPlanId"
            defaultValue={defaultBudgetId}
            key={`budget-${defaultBudgetId}-${state?.ok ? "ok" : "idle"}`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          >
            <option value="">Budget envelope (optional)</option>
            {budgetPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="tags"
            placeholder="Tags (comma-separated, optional)"
            defaultValue={defaultTags}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
        </div>
      ) : null}

      {kind === "bill" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            name="title"
            placeholder="Bill name (rent, electric, …)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="amount"
            placeholder="Amount"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="dueDate"
            type="date"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-3"
          />
        </div>
      ) : null}

      {kind === "budget_line" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Envelope name (e.g. Groceries)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="category"
            placeholder="Match text (optional)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="limit"
            placeholder="Monthly limit"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="rolledIn"
            placeholder="Rolled in (optional)"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="note"
            placeholder="Note (optional)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
        </div>
      ) : null}

      {kind === "paycheck" ? (
        <div className="grid gap-3">
          <input
            name="amount"
            placeholder="Take-home amount (optional if photo/PDF is readable)"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div>
            <label htmlFor="paystubFile" className="text-sm font-medium">
              Pay stub screenshot or PDF (optional)
            </label>
            <input
              id="paystubFile"
              name="paystubFile"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="mt-1 block w-full text-sm"
            />
          </div>
          <input
            name="receivedOn"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="note"
            placeholder="Memo (optional, e.g. Employer — Feb 15)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Saved. Budget and tags will pre-fill your next entry this month.
        </p>
      ) : null}
    </form>
  );
}
