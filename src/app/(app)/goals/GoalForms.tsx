"use client";

import { useActionState } from "react";
import {
  addSavingsGoalAction,
  addSpendingAdjustmentAction,
  updateGoalSavedAction,
} from "@/app/actions/goals";
import { initialFormState } from "@/lib/formActionState";

export function GoalForms({
  goals,
}: {
  goals: { id: string; title: string }[];
}) {
  const [goalState, addGoal, goalPending] = useActionState(
    addSavingsGoalAction,
    initialFormState,
  );
  const [adjState, addAdj, adjPending] = useActionState(
    addSpendingAdjustmentAction,
    initialFormState,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="font-medium">New savings goal</h2>
        <form action={addGoal} className="mt-3 grid gap-2">
          {goalState?.error ? (
            <p className="text-sm text-red-600">{goalState.error}</p>
          ) : null}
          <input
            name="title"
            placeholder="Emergency fund, vacation…"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="target"
              placeholder="Target amount"
              inputMode="decimal"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="saved"
              placeholder="Already saved (optional)"
              inputMode="decimal"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <input
            name="deadline"
            type="date"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={goalPending}
            className="rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Add goal
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-medium">Spending adjustment</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Planned cuts or extra monthly savings toward a goal.
        </p>
        <form action={addAdj} className="mt-3 grid gap-2">
          {adjState?.error ? (
            <p className="text-sm text-red-600">{adjState.error}</p>
          ) : null}
          <select
            name="goalId"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Household (no specific goal)</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <input
            name="label"
            placeholder="Label, e.g. Meal kit pause"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="amount"
            placeholder="Monthly amount"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={adjPending}
            className="rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Save adjustment
          </button>
        </form>
      </div>
    </div>
  );
}

export function UpdateSavedForm({
  goalId,
  savedCents,
}: {
  goalId: string;
  savedCents: number;
}) {
  const [state, action, pending] = useActionState(
    updateGoalSavedAction,
    initialFormState,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="goalId" value={goalId} />
      <div>
        <label className="text-xs text-zinc-500" htmlFor={`saved-${goalId}`}>
          Update saved
        </label>
        <input
          id={`saved-${goalId}`}
          name="saved"
          defaultValue={(savedCents / 100).toFixed(2)}
          inputMode="decimal"
          className="mt-0.5 block w-28 rounded border border-zinc-300 px-2 py-1 tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Save
      </button>
      {state?.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
