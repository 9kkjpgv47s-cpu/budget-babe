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
    <form action={copyBudgetPlansFromPreviousMonthAction} className="mt-3 inline-block">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        Copy budget lines from {prevYm}
      </button>
      <p className="mt-1 max-w-xl text-xs text-zinc-500">
        Adds lines with the same name, category, limit, and note; rolled-in starts
        at zero. Skips names that already exist this month.
      </p>
    </form>
  );
}
