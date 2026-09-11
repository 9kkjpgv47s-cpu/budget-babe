import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";

export function PlaidMonthNote({ yearMonth }: { yearMonth: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/80 px-4 py-3 text-sm dark:border-border dark:bg-zinc-900/50">
      <p className="text-foreground">
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
