import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";

export function PlaidMonthNote({ yearMonth }: { yearMonth: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-zinc-700 dark:text-zinc-300">
        Synced transactions land in <strong>{yearMonth}</strong> by transaction
        date. After sync, assign budget envelopes on Expenses — imports do not
        pick a budget automatically.
      </p>
      <div className="mt-2">
        <MonthWorkflowLinks yearMonth={yearMonth} />
      </div>
    </div>
  );
}
