import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";

export async function NetWorthCashFlowCompare({ yearMonth }: { yearMonth: string }) {
  const [data, accounts, debtTotal] = await Promise.all([
    getDashboardData(yearMonth),
    prisma.netWorthAccount.findMany({
      select: { kind: true, balanceCents: true },
    }),
    prisma.debtAccount.aggregate({ _sum: { balanceCents: true } }),
  ]);

  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (a.kind === "asset") assets += a.balanceCents;
    else liabilities += a.balanceCents;
  }
  const net = assets - liabilities;
  const debtTracked = debtTotal._sum.balanceCents ?? 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Compare to {yearMonth} cash flow</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Net worth snapshots are long-term. Monthly income and spending live on
        the overview — they do not change when you edit accounts here.
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
            Net worth (manual)
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCents(net)}
          </dd>
          <dd className="text-xs text-zinc-500">
            Assets {formatCents(assets)} · Liabilities {formatCents(liabilities)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Debt page (manual)
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCents(debtTracked)}
          </dd>
          <dd className="text-xs text-zinc-500">
            {debtTracked !== liabilities
              ? "May differ from liability lines here — keep both in sync yourself."
              : "Matches liability total on this page."}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Paycheck coach uses overview income and bills, not net worth. After a
        snapshot, update goal saved amounts on Goals if you moved money — net
        worth does not push progress automatically.
      </p>
      <p className="mt-2 text-xs">
        <Link href="/debt" className="text-emerald-600 underline">
          Debt minimums vs cash left
        </Link>
        {" · "}
        <Link href={`/goals?ym=${yearMonth}`} className="text-emerald-600 underline">
          Goals
        </Link>
      </p>
      <div className="mt-3">
        <MonthWorkflowLinks yearMonth={yearMonth} />
      </div>
    </section>
  );
}
