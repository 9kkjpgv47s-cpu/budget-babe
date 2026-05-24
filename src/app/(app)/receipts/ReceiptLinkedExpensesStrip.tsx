import Link from "next/link";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { displayFilename } from "./receiptDisplay";

export async function ReceiptLinkedExpensesStrip({
  yearMonth,
}: {
  yearMonth: string;
}) {
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const [linked, totalLinked] = await Promise.all([
    prisma.expense.findMany({
      where: {
        monthlyPeriodId: period.id,
        receiptId: { not: null },
      },
      orderBy: { spentAt: "desc" },
      take: 12,
      include: {
        receipt: { select: { id: true, filename: true } },
      },
    }),
    prisma.expense.count({
      where: {
        monthlyPeriodId: period.id,
        receiptId: { not: null },
      },
    }),
  ]);

  if (linked.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Spending linked to receipts
        </h2>
        {totalLinked > linked.length ? (
          <Link
            href={`/expenses?ym=${yearMonth}`}
            className="text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            View all {totalLinked} →
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Jump back to the source photo or PDF for tax documentation.{" "}
        <Link
          href={`/receipts?ym=${yearMonth}#upload`}
          className="font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          Scan another receipt
        </Link>
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {linked.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="min-w-0">
              <span className="font-medium">{e.description}</span>
              <span className="ml-2 tabular-nums text-zinc-600">
                {formatCents(e.amountCents)}
              </span>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              {e.receipt ? (
                <>
                  <a
                    href={`/api/receipts/${e.receipt.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline dark:text-emerald-400"
                  >
                    View scan
                  </a>
                  <Link
                    href={`/receipts?ym=${yearMonth}&focus=${e.receipt.id}`}
                    className="text-emerald-700 underline dark:text-emerald-400"
                  >
                    {displayFilename(e.receipt.filename)}
                  </Link>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
