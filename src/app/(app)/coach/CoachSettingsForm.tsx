import { updateCoachSettingsAction } from "@/app/actions/coach";
import { SAVINGS_RATE_OPTIONS } from "@/lib/paycheckCoach";

export function CoachSettingsForm({
  savingsRatePercentTarget,
  payPeriodsPerMonth,
}: {
  savingsRatePercentTarget: number;
  payPeriodsPerMonth: number;
}) {
  return (
    <form action={updateCoachSettingsAction} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="savingsRate">
          Save this percent of each paycheck (before variable spending)
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Applied to your monthly income divided by paychecks per month. Goal:
          end each check with extra — pay yourself first.
        </p>
        <select
          id="savingsRate"
          name="savingsRatePercent"
          defaultValue={savingsRatePercentTarget}
          className="mt-2 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {SAVINGS_RATE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="periods">
          Paychecks per month
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Used to split your planned monthly income into one paycheck amount
          (e.g. 2 for biweekly, 1 for monthly).
        </p>
        <select
          id="periods"
          name="payPeriodsPerMonth"
          defaultValue={payPeriodsPerMonth}
          className="mt-2 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Save coach settings
      </button>
    </form>
  );
}
