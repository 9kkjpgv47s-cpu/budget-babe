import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { currentYearMonth } from "@/lib/yearMonth";
import { addMerchantRuleAction } from "@/app/actions/rules";
import { ensureDefaultCategories } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { CategorySection } from "../budgets/CategorySection";
import { ImportBulkSection } from "./ImportBulkSection";
import { MerchantRulesList } from "./MerchantRulesList";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  await ensureDefaultCategories();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const [rules, categories] = await Promise.all([
    prisma.merchantRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { expenses: true } } },
    }),
  ]);
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const budgetPlans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import & rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Paste bank **CSV**, **OFX/QFX**, or **QIF** exports. Duplicates in the
          same month are skipped. Optional column numbers fix weird CSV layouts.
          Rules add tags when a description contains your pattern. Optional category
          assigns a canonical class (links budget envelope + tax folder). CSV import
          and export support a <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">category</code>{" "}
          column (name or slug).
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${yearMonth}`} className="text-emerald-600 underline">
            ← Overview ({yearMonth})
          </Link>
          {" · "}
          <a
            href={`/api/export/expenses?ym=${yearMonth}`}
            className="text-emerald-600 underline"
          >
            Download expenses CSV
          </a>
          {" · "}
          <a
            href={`/api/export/bills?ym=${yearMonth}`}
            className="text-emerald-600 underline"
          >
            Download bills CSV
          </a>
          {" · "}
          <a
            href={`/api/export/budgets?ym=${yearMonth}`}
            className="text-emerald-600 underline"
          >
            Download budgets CSV
          </a>
        </p>
      </div>

      <ImportBulkSection
        yearMonth={yearMonth}
        budgetPlans={budgetPlans}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <CategorySection
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          matchText: c.matchText,
          budgetEnvelopeName: c.budgetEnvelopeName,
          defaultTaxCategory: c.defaultTaxCategory,
          expenseCount: c._count.expenses,
        }))}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Merchant rules</h2>
        <p className="mt-1 text-xs text-zinc-500">
          If description contains <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">pattern</code>, add{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">tag</code>{" "}
          (used in budget matching and Insights).
        </p>
        <form action={addMerchantRuleAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input
            name="pattern"
            placeholder="amazon"
            className="min-w-[8rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="tag"
            placeholder="groceries"
            className="min-w-[8rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            name="categoryId"
            className="min-w-[8rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            defaultValue=""
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add rule
          </button>
        </form>
        <MerchantRulesList
          rules={rules.map((r) => ({
            id: r.id,
            pattern: r.pattern,
            tag: r.tag,
            categoryId: r.categoryId,
            categoryName: r.category?.name ?? null,
          }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>
    </div>
  );
}
