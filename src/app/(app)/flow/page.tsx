import { startOfMonth } from "date-fns";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";
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

  for (const p of data.paychecks) {
    rows.push({
      sort: p.receivedOn.getTime(),
      date: p.receivedOn,
      label: p.note?.trim() ? `Paycheck: ${p.note.trim()}` : "Paycheck",
      amountCents: p.amountCents,
      kind: "paycheck",
    });
  }
  if (data.paychecks.length === 0 && data.period.incomeCents > 0) {
    rows.push({
      sort: monthStart.getTime(),
      date: monthStart,
      label: "Planned income (legacy — add paychecks on overview)",
      amountCents: data.period.incomeCents,
      kind: "income",
    });
  }

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
        <p className="mt-1 text-sm text-muted-foreground">
          Income rows are individual paychecks (plus legacy planned income if you have not added paychecks yet).{" "}
          (chronological).
        </p>
        <div className="mt-2">
          <MonthWorkflowLinks yearMonth={ym} />
        </div>
      </div>
      <ul className="space-y-2 rounded-xl border border-border bg-white p-4 text-sm dark:border-border dark:bg-zinc-900">
        {rows.map((r, i) => (
          <li
            key={`${r.kind}-${i}-${r.sort}`}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-50 py-2 last:border-0 dark:border-border"
          >
            <div>
              <span className="text-xs text-muted-foreground">
                {r.date.toLocaleDateString()}
              </span>
              <span className="ml-2 font-medium">{r.label}</span>
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {r.kind}
              </span>
            </div>
            {r.amountCents != null ? (
              <span className="tabular-nums text-foreground">
                {r.kind === "income" || r.kind === "paycheck" ? "+" : ""}
                {formatCents(r.amountCents)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
