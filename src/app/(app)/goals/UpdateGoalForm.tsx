"use client";

import { useActionState } from "react";
import { updateSavingsGoalAction } from "@/app/actions/goals";
import { initialFormState } from "@/lib/formActionState";

export function UpdateGoalForm({
  goalId,
  title,
  targetCents,
  deadline,
}: {
  goalId: string;
  title: string;
  targetCents: number;
  deadline: Date | null;
}) {
  const [state, action, pending] = useActionState(
    updateSavingsGoalAction,
    initialFormState,
  );
  const deadlineStr = deadline
    ? `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`
    : "";

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-emerald-700 dark:text-emerald-400">
        Edit goal details
      </summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="goalId" value={goalId} />
        <input
          name="title"
          defaultValue={title}
          className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="target"
          defaultValue={(targetCents / 100).toFixed(2)}
          inputMode="decimal"
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="deadline"
          type="date"
          defaultValue={deadlineStr}
          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 rounded bg-zinc-200 py-1 text-xs font-medium dark:bg-zinc-800"
        >
          Save goal
        </button>
        {state?.error ? (
          <p className="sm:col-span-2 text-xs text-red-600">{state.error}</p>
        ) : null}
      </form>
    </details>
  );
}
