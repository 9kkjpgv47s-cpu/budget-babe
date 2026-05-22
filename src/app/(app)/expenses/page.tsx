import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { ExpensesInteractiveList } from "./ExpensesInteractiveList";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ym?: string;
    q?: string;
    taxErr?: string;
    cat?: string;
    uncategorized?: string;
  }>;
}) {
  await requireUser();
  await ensureDefaultCategories();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const q = (sp.q ?? "").trim();
  const taxErrRaw = sp.taxErr?.trim();
  const taxErr = taxErrRaw ? decodeURIComponent(taxErrRaw.replace(/\+/g, " ")) : null;
  const uncategorizedOnly = sp.uncategorized === "1";
  const catParam = (sp.cat ?? "").trim();
  const period = await getOrCreateMonthlyPeriod(ym);

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));

  let filterCategoryId: string | null = null;
  let filterCategoryName: string | null = null;
  if (catParam && !uncategorizedOnly) {
    const byId = categoryById.get(catParam);
    const bySlug = categoryBySlug.get(catParam.toLowerCase());
    const cat = byId ?? bySlug;
    if (cat) {
      filterCategoryId = cat.id;
      filterCategoryName = cat.name;
    }
  }

  const expenseWhere = {
    monthlyPeriodId: period.id,
    ...(uncategorizedOnly ? { categoryId: null } : {}),
    ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
  };

  const allExpenses = await prisma.expense.findMany({
    where: expenseWhere,
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

  const [plans, uncategorizedCount, uncategorizedSum] = await Promise.all([
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
    }),
    prisma.expense.count({
      where: { monthlyPeriodId: period.id, categoryId: null },
    }),
    prisma.expense.aggregate({
      where: { monthlyPeriodId: period.id, categoryId: null },
      _sum: { amountCents: true },
    }),
  ]);

  const rows = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    spentAt: e.spentAt.toISOString(),
    budgetPlanId: e.budgetPlanId,
    categoryId: e.categoryId,
    categoryName: e.categoryId ? (categoryById.get(e.categoryId)?.name ?? null) : null,
    tagsJson: e.tagsJson,
    splitGroupId: e.splitGroupId,
    payee: e.payee,
    userName: e.user?.name ?? null,
    receiptId: e.receiptId,
    taxApplicability: e.taxApplicability,
    taxCodeRefId: e.taxCodeRefId,
    taxCategory: e.taxCategory,
    taxNote: e.taxNote,
    taxReviewedAt: e.taxReviewedAt?.toISOString() ?? null,
  }));

  const filterLabel = uncategorizedOnly
    ? "Uncategorized"
    : filterCategoryName
      ? filterCategoryName
      : null;

  return (
    <div className="space-y-4">
      {filterLabel || uncategorizedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {filterLabel ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
              Filter: {filterLabel}
              <Link
                href={`/expenses?ym=${ym}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="ml-2 underline"
              >
                Clear
              </Link>
            </span>
          ) : null}
          {uncategorizedCount > 0 && !uncategorizedOnly ? (
            <Link
              href={`/expenses?ym=${ym}&uncategorized=1`}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-950 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {uncategorizedCount} uncategorized (
              {formatCents(uncategorizedSum._sum.amountCents ?? 0)})
            </Link>
          ) : null}
        </div>
      ) : null}
      <ExpensesInteractiveList
        yearMonth={ym}
        searchQuery={q}
        expenses={rows}
        allExpenseCount={allExpenses.length}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        uncategorizedCount={uncategorizedCount}
        taxErr={taxErr}
      />
    </div>
  );
}
