import { copyBudgetPlansFromPreviousMonthAction } from "@/app/actions/budgetPlan";

export function BudgetCopyHeader({
  yearMonth,
  prevYm,
  hasPrevPeriod,
}: {
  yearMonth: string;
  prevYm: string;
  hasPrevPeriod: boolean;
}) {
  if (!hasPrevPeriod) return null;
  return (
    <form
      action={copyBudgetPlansFromPreviousMonthAction}
      className="mt-4 max-w-xl space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="withRollover"
          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          After copying, <strong>apply suggested rolled-in</strong> from {prevYm}{" "}
          (same as the button above — matches by line name).
        </span>
      </label>
      <div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Copy budget lines from {prevYm}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Adds lines with the same name, category, limit, and note; rolled-in starts
        at zero unless the box is checked. Skips names that already exist this month.
      </p>
    </form>
  );
}
