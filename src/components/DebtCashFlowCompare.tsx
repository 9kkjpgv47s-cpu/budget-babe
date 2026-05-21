import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";

export async function DebtCashFlowCompare({ yearMonth }: { yearMonth: string }) {
  const [data, accounts] = await Promise.all([
    getDashboardData(yearMonth),
    prisma.debtAccount.findMany({
      select: { balanceCents: true, minimumPaymentCents: true },
    }),
  ]);

  const totalOwed = accounts.reduce((s, a) => s + a.balanceCents, 0);
  const minTotal = accounts.reduce(
    (s, a) => s + (a.minimumPaymentCents ?? 0),
    0,
  );

  const minFits =
    minTotal > 0 && data.leftAfterUpcomingBills >= minTotal;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Compare to {yearMonth} cash flow</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Debt balances here are manual. This table compares minimum payments to
        the same income and bills the overview and coach use.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Overview income
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.incomeCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Spent ({yearMonth})
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.spentTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Cash left before next pay
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.leftAfterUpcomingBills)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Debt tracked here
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(totalOwed)}
          </dd>
          {minTotal > 0 ? (
            <dd className="text-xs text-zinc-500">
              Min payments sum: {formatCents(minTotal)}
            </dd>
          ) : null}
        </div>
      </dl>
      {minTotal > 0 ? (
        <p
          className={`mt-4 text-sm ${minFits ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
        >
          {minFits
            ? "Sum of minimum payments fits within cash left before next pay on the overview — still log card/loan payments as Bills or Expenses so coach and spent totals stay accurate."
            : "Sum of minimum payments exceeds cash left before next pay on the overview. Add paychecks, trim bills, or log real payments on Expenses — updating balances here alone will not fix monthly cash flow."}
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Add minimum payment amounts on each account to compare against monthly
          cash left.
        </p>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        <Link
          href={`/bills?ym=${yearMonth}`}
          className="text-emerald-600 underline"
        >
          Bills
        </Link>
        {" · "}
        <Link
          href={`/expenses?ym=${yearMonth}`}
          className="text-emerald-600 underline"
        >
          Expenses
        </Link>
        {" · "}
        <Link
          href={`/net-worth`}
          className="text-emerald-600 underline"
        >
          Net worth
        </Link>
      </p>
      <div className="mt-3">
        <MonthWorkflowLinks yearMonth={yearMonth} />
      </div>
    </section>
  );
}
