import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { ExpensesInteractiveList } from "./ExpensesInteractiveList";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; q?: string; taxErr?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const q = (sp.q ?? "").trim();
  const taxErrRaw = sp.taxErr?.trim();
  const taxErr = taxErrRaw ? decodeURIComponent(taxErrRaw.replace(/\+/g, " ")) : null;
  const period = await getOrCreateMonthlyPeriod(ym);

  const allExpenses = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { spentAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  const ql = q.toLowerCase();
  const expenses =
    q.length > 0
      ? allExpenses.filter(
          (e) =>
            e.description.toLowerCase().includes(ql) ||
            (e.payee?.toLowerCase().includes(ql) ?? false),
        )
      : allExpenses;

  const plans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { name: "asc" },
  });

  const rows = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    spentAt: e.spentAt.toISOString(),
    budgetPlanId: e.budgetPlanId,
    tagsJson: e.tagsJson,
    splitGroupId: e.splitGroupId,
    userName: e.user?.name ?? null,
    receiptId: e.receiptId,
    taxApplicability: e.taxApplicability,
    taxCodeRefId: e.taxCodeRefId,
    taxCategory: e.taxCategory,
    taxNote: e.taxNote,
    taxReviewedAt: e.taxReviewedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-30 -mx-1 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 shadow-sm backdrop-blur dark:border-emerald-800 dark:bg-emerald-950/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            Have a receipt photo? OCR fills amount and description for you.
          </p>
          <Link
            href={`/receipts?ym=${ym}`}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Add from receipt
          </Link>
        </div>
      </div>
      <ExpensesInteractiveList
      yearMonth={ym}
      searchQuery={q}
      expenses={rows}
      allExpenseCount={allExpenses.length}
      plans={plans.map((p) => ({ id: p.id, name: p.name }))}
      taxErr={taxErr}
    />
    </div>
  );
}
