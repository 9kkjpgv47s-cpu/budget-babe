import Link from "next/link";
import { startOfMonth } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getDashboardData, ensureHouseholdSettings } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";

type FlowRow = {
  sort: number;
  date: Date;
  label: string;
  amountCents: number | null;
  kind: string;
};

export default async function FlowPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const data = await getDashboardData(ym);
  await ensureHouseholdSettings();
  const settings = await prisma.householdSettings.findUnique({
    where: { id: 1 },
  });

  const monthStart = startOfMonth(
    new Date(`${ym}-01T12:00:00`),
  );

  const rows: FlowRow[] = [];

  rows.push({
    sort: monthStart.getTime(),
    date: monthStart,
    label: "Planned monthly income",
    amountCents: data.period.incomeCents,
    kind: "income",
  });

  if (settings?.nextPaycheckDate) {
    rows.push({
      sort: settings.nextPaycheckDate.getTime(),
      date: settings.nextPaycheckDate,
      label: "Next paycheck (anchor)",
      amountCents: null,
      kind: "payday",
    });
  }

  for (const b of data.bills) {
    if (b.paid) continue;
    rows.push({
      sort: b.dueDate.getTime(),
      date: b.dueDate,
      label: `Bill: ${b.title}`,
      amountCents: b.amountCents,
      kind: "bill",
    });
  }

  for (const e of data.expenses.slice(0, 40)) {
    rows.push({
      sort: e.spentAt.getTime(),
      date: e.spentAt,
      label: e.description,
      amountCents: e.amountCents,
      kind: "expense",
    });
  }

  rows.sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash flow</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Income anchor, paycheck date, bills, and recent expenses for {ym}{" "}
          (chronological).
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${ym}`} className="text-emerald-600 underline">
            ← Overview
          </Link>
        </p>
      </div>
      <ul className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {rows.map((r, i) => (
          <li
            key={`${r.kind}-${i}-${r.sort}`}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-50 py-2 last:border-0 dark:border-zinc-800"
          >
            <div>
              <span className="text-xs text-zinc-500">
                {r.date.toLocaleDateString()}
              </span>
              <span className="ml-2 font-medium">{r.label}</span>
              <span className="ml-2 text-xs uppercase text-zinc-400">
                {r.kind}
              </span>
            </div>
            {r.amountCents != null ? (
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {r.kind === "income" ? "+" : ""}
                {formatCents(r.amountCents)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
