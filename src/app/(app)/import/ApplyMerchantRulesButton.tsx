"use client";

import { useActionState } from "react";
import { applyMerchantRulesToMonthAction } from "@/app/actions/rules";
import { initialFormState } from "@/lib/formActionState";

export function ApplyMerchantRulesButton({ yearMonth }: { yearMonth: string }) {
  const [state, action, pending] = useActionState(
    applyMerchantRulesToMonthAction,
    initialFormState,
  );

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
      <p className="text-sm text-muted-foreground">
        Rules apply automatically when you <strong>create or edit</strong> an expense.
        Use this to re-run tags, payee hints, budget links, and category matching on
        expenses you already imported for{" "}
        <span className="font-mono text-foreground">{yearMonth}</span>.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-muted disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          {pending ? "Applying…" : "Apply rules to this month’s expenses"}
        </button>
      </form>
      {state?.error ? (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="mt-2 text-sm text-accent ">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
