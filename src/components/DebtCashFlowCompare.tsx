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
    <section className="card p-5">
      <h2 className="font-medium">Compare to {yearMonth} cash flow</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Debt balances here are manual. This table compares minimum payments to
        the same income and bills the overview and coach use.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overview income
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.incomeCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Spent ({yearMonth})
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.spentTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cash left before next pay
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(data.leftAfterUpcomingBills)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Debt tracked here
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(totalOwed)}
          </dd>
          {minTotal > 0 ? (
            <dd className="text-xs text-muted-foreground">
              Min payments sum: {formatCents(minTotal)}
            </dd>
          ) : null}
        </div>
      </dl>
      {minTotal > 0 ? (
        <p
          className={`mt-4 text-sm ${minFits ? "text-accent " : "text-red-700 dark:text-red-300"}`}
        >
          {minFits
            ? "Sum of minimum payments fits within cash left before next pay on the overview — still log card/loan payments as Bills or Expenses so coach and spent totals stay accurate."
            : "Sum of minimum payments exceeds cash left before next pay on the overview. Add paychecks, trim bills, or log real payments on Expenses — updating balances here alone will not fix monthly cash flow."}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Add minimum payment amounts on each account to compare against monthly
          cash left.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        <Link
          href={`/bills?ym=${yearMonth}`}
          className="text-accent underline"
        >
          Bills
        </Link>
        {" · "}
        <Link
          href={`/expenses?ym=${yearMonth}`}
          className="text-accent underline"
        >
          Expenses
        </Link>
        {" · "}
        <Link
          href={`/net-worth`}
          className="text-accent underline"
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
