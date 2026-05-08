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
    <ExpensesInteractiveList
      yearMonth={ym}
      searchQuery={q}
      expenses={rows}
      allExpenseCount={allExpenses.length}
      plans={plans.map((p) => ({ id: p.id, name: p.name }))}
      taxErr={taxErr}
    />
  );
}
