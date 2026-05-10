import { formatCents } from "@/lib/money";
import {
  copyBillsFromPreviousMonthAction,
  deleteBillAction,
  toggleBillPaidAction,
  updateBillAction,
} from "@/app/actions/monthly";

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function BillsSectionHeader({
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
    <form action={copyBillsFromPreviousMonthAction} className="mb-3">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        Copy bills from {prevYm}
      </button>
      <p className="mt-1 text-xs text-zinc-500">
        Skips a row if this month already has the same title, amount, and due
        date (stops duplicate runs).
      </p>
    </form>
  );
}

export function BillRow({
  yearMonth,
  bill,
}: {
  yearMonth: string;
  bill: {
    id: string;
    title: string;
    amountCents: number;
    dueDate: Date;
    paid: boolean;
  };
}) {
  return (
    <li className="space-y-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <div className="font-medium">{bill.title}</div>
          <div className="text-xs text-zinc-500">
            Due {bill.dueDate.toLocaleDateString()} · {formatCents(bill.amountCents)}
          </div>
        </div>
        <form action={toggleBillPaidAction}>
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="paid" value={(!bill.paid).toString()} />
          <button
            type="submit"
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              bill.paid
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {bill.paid ? "Paid" : "Mark paid"}
          </button>
        </form>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-emerald-700 dark:text-emerald-400">
          Edit or remove
        </summary>
        <form action={updateBillAction} className="mt-2 grid gap-1 sm:grid-cols-2">
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input
            name="title"
            defaultValue={bill.title}
            className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="amount"
            defaultValue={(bill.amountCents / 100).toFixed(2)}
            inputMode="decimal"
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="dueDate"
            type="date"
            defaultValue={toDateInput(bill.dueDate)}
            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="paid" defaultChecked={bill.paid} />
            <span>Paid</span>
          </label>
          <button
            type="submit"
            className="sm:col-span-2 rounded bg-zinc-200 py-1 text-xs font-medium dark:bg-zinc-800"
          >
            Save bill
          </button>
        </form>
        <form action={deleteBillAction} className="mt-2">
          <input type="hidden" name="billId" value={bill.id} />
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <button type="submit" className="text-xs text-red-600 underline hover:no-underline">
            Delete bill
          </button>
        </form>
      </details>
    </li>
  );
}
