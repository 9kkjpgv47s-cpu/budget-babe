import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { currentYearMonth } from "@/lib/yearMonth";
import { addMerchantRuleAction } from "@/app/actions/rules";
import { ensureDefaultCategories } from "@/lib/categories";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { MonthWorkflowLinks } from "@/components/MonthWorkflowLinks";
import {
  getLastExpenseDefaultsForYearMonth,
  sanitizeExpenseDefaultsForPlans,
} from "@/lib/entryDefaults";
import { CategorySection } from "../budgets/CategorySection";
import { ImportBulkSection } from "./ImportBulkSection";
import { MerchantRulesList } from "./MerchantRulesList";
import { ApplyMerchantRulesButton } from "./ApplyMerchantRulesButton";

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
  const splitDefaults = sanitizeExpenseDefaultsForPlans(
    await getLastExpenseDefaultsForYearMonth(yearMonth),
    budgetPlans.map((p) => p.id),
    categories.map((c) => c.id),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import & rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Paste bank **CSV**, **OFX/QFX**, or **QIF** exports. Duplicates in the
          same month are skipped. Optional column numbers fix weird CSV layouts.
          Rules add tags when a description contains your pattern. Optional category
          assigns a canonical class (links budget envelope + tax folder). CSV import
          and export support a <code className="rounded bg-muted px-1 dark:bg-zinc-800">category</code>{" "}
          column (name or slug).
        </p>
        <div className="mt-2">
          <MonthWorkflowLinks yearMonth={yearMonth} />
        </div>
        <p className="mt-2 text-sm">
          <a
            href={`/api/export/expenses?ym=${yearMonth}`}
            className="text-accent underline"
          >
            Download expenses CSV
          </a>
          {" · "}
          <a
            href={`/api/export/bills?ym=${yearMonth}`}
            className="text-accent underline"
          >
            Download bills CSV
          </a>
          {" · "}
          <a
            href={`/api/export/budgets?ym=${yearMonth}`}
            className="text-accent underline"
          >
            Download budgets CSV
          </a>
        </p>
      </div>

      <ImportBulkSection
        yearMonth={yearMonth}
        budgetPlans={budgetPlans}
        defaultBudgetPlanId={splitDefaults.budgetPlanId}
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

      <section
        id="merchant-rules"
        className="rounded-xl border border-border bg-white p-5 scroll-mt-24 dark:border-border dark:bg-zinc-900"
      >
        <h2 className="font-medium">Merchant rules</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          If description contains <code className="rounded bg-muted px-1 dark:bg-zinc-800">pattern</code>, add{" "}
          <code className="rounded bg-muted px-1 dark:bg-zinc-800">tag</code>{" "}
          (used in budget matching and Insights). Optional category links envelope + tax folder.
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
            className="btn btn-primary"
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
        {rules.length === 0 ? null : (
          <ApplyMerchantRulesButton yearMonth={yearMonth} />
        )}
      </section>
    </div>
  );
}
