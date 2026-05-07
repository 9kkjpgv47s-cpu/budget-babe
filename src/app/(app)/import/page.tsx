import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { currentYearMonth } from "@/lib/yearMonth";
import { deleteMerchantRuleAction, addMerchantRuleAction } from "@/app/actions/rules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { ImportBulkSection } from "./ImportBulkSection";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const rules = await prisma.merchantRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
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
          Rules add tags when a description contains your pattern — tags help
          match budget lines.
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

      <ImportBulkSection yearMonth={yearMonth} budgetPlans={budgetPlans} />

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
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add rule
          </button>
        </form>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span>
                <span className="font-mono text-zinc-600">{r.pattern}</span>
                {" → "}
                <span className="font-medium">{r.tag}</span>
              </span>
              <form action={deleteMerchantRuleAction}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 underline hover:no-underline"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No rules yet.</p>
        ) : null}
      </section>
    </div>
  );
}
