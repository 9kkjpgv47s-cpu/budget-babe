import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { ExpensesInteractiveList } from "./ExpensesInteractiveList";
import { MonthNav } from "@/components/ui";
import { addMonths, format } from "date-fns";
import { parseYearMonth } from "@/lib/yearMonth";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ym?: string;
    q?: string;
    taxErr?: string;
    cat?: string;
    uncategorized?: string;
    classified?: string;
    scanned?: string;
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
  const classifiedRaw = sp.classified?.trim();
  const classifiedCount =
    classifiedRaw != null && classifiedRaw !== "" ? Number.parseInt(classifiedRaw, 10) : null;
  const scannedCount = sp.scanned?.trim()
    ? Number.parseInt(sp.scanned, 10)
    : null;
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

  const [allExpenses, monthExpenseTotal, plans, uncategorizedCount, uncategorizedSum] =
    await Promise.all([
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: { spentAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.expense.count({ where: { monthlyPeriodId: period.id } }),
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

  const ql = q.toLowerCase();
  const expenses =
    q.length > 0
      ? allExpenses.filter((e) => {
          const cat = e.categoryId ? categoryById.get(e.categoryId) : null;
          const haystack = [
            e.description,
            e.payee ?? "",
            cat?.name ?? "",
            cat?.slug ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(ql);
        })
      : allExpenses;

  const categoryChipTotals = new Map<
    string,
    { id: string; name: string; slug: string; count: number; totalCents: number }
  >();
  const monthExpenses = await prisma.expense.findMany({
    where: { monthlyPeriodId: period.id },
    select: { categoryId: true, amountCents: true },
  });
  for (const e of monthExpenses) {
    if (!e.categoryId) continue;
    const cat = categoryById.get(e.categoryId);
    if (!cat) continue;
    const cur = categoryChipTotals.get(cat.id) ?? {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: 0,
      totalCents: 0,
    };
    cur.count += 1;
    cur.totalCents += e.amountCents;
    categoryChipTotals.set(cat.id, cur);
  }

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

  const categoryChips = [...categoryChipTotals.values()].sort(
    (a, b) => b.totalCents - a.totalCents,
  );

  let classifyMessage: string | null = null;
  if (classifiedCount != null && Number.isFinite(classifiedCount)) {
    if (classifiedCount > 0) {
      classifyMessage = `Auto-classified ${classifiedCount} expense${classifiedCount === 1 ? "" : "s"}.`;
    } else if (scannedCount != null && Number.isFinite(scannedCount)) {
      classifyMessage = `Scanned ${scannedCount} uncategorized — no new matches from rules.`;
    }
  }

  const prevYm = format(addMonths(parseYearMonth(ym), -1), "yyyy-MM");
  const nextYm = format(addMonths(parseYearMonth(ym), 1), "yyyy-MM");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MonthNav yearMonth={ym} prevYm={prevYm} nextYm={nextYm} />
      </div>
      {classifyMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 ">
          {classifyMessage}
        </p>
      ) : null}
      {categoryChips.length > 0 || uncategorizedCount > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {categoryChips.map((c) => {
            const active = filterCategoryId === c.id;
            return (
              <Link
                key={c.id}
                href={`/expenses?ym=${ym}&cat=${encodeURIComponent(c.slug)}`}
                className={`chip ${active ? "chip-active" : ""}`}
              >
                {c.name} · {formatCents(c.totalCents)}
              </Link>
            );
          })}
          {uncategorizedCount > 0 ? (
            <Link
              href={`/expenses?ym=${ym}&uncategorized=1`}
              className={`chip ${
                uncategorizedOnly
                  ? "!border-amber-500 !bg-amber-500 !text-white"
                  : "!border-amber-300 !bg-amber-50 !text-amber-900 dark:!border-amber-800 dark:!bg-amber-950/40 dark:!text-amber-100"
              }`}
            >
              Uncategorized · {formatCents(uncategorizedSum._sum.amountCents ?? 0)}
            </Link>
          ) : null}
          {filterLabel ? (
            <Link
              href={`/expenses?ym=${ym}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="self-center text-muted-foreground underline"
            >
              Clear filter
            </Link>
          ) : null}
        </div>
      ) : null}
      <ExpensesInteractiveList
        yearMonth={ym}
        searchQuery={q}
        expenses={rows}
        allExpenseCount={allExpenses.length}
        monthExpenseTotal={monthExpenseTotal}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        uncategorizedCount={uncategorizedCount}
        taxErr={taxErr}
      />
    </div>
  );
}
