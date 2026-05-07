import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/yearMonth";
import { formatCents } from "@/lib/money";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions/expenses";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTagsDisplay(raw: string | null): string {
  if (!raw) return "";
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return "";
    return v.filter((x): x is string => typeof x === "string").join(", ");
  } catch {
    return "";
  }
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const ym = sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(ym);
  const [expenses, plans] = await Promise.all([
    prisma.expense.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { spentAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All expenses</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Edit or delete. Use Import for CSV/OFX/QIF and split wizard.
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${ym}`} className="text-emerald-600 underline">
            ← Overview ({ym})
          </Link>
          {" · "}
          <Link href="/import" className="text-emerald-600 underline">
            Import
          </Link>
        </p>
      </div>
      <ul className="space-y-4">
        {expenses.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
              <span>{e.spentAt.toLocaleString()}</span>
              <span>{e.user?.name}</span>
              <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                {formatCents(e.amountCents)}
              </span>
            </div>
            {e.splitGroupId ? (
              <p className="mb-2 text-xs text-zinc-400">Split: {e.splitGroupId}</p>
            ) : null}
            <form action={updateExpenseAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="yearMonth" value={ym} />
              <input
                name="description"
                defaultValue={e.description}
                className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                name="amount"
                defaultValue={(e.amountCents / 100).toFixed(2)}
                inputMode="decimal"
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                name="spentAt"
                type="datetime-local"
                defaultValue={toLocalInput(e.spentAt)}
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <select
                name="budgetPlanId"
                defaultValue={e.budgetPlanId ?? ""}
                className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
              >
                <option value="">No budget link</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                name="tags"
                defaultValue={parseTagsDisplay(e.tagsJson)}
                placeholder="tags, comma"
                className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="submit"
                className="rounded bg-emerald-600 py-1 text-xs text-white sm:col-span-2"
              >
                Save changes
              </button>
            </form>
            <form action={deleteExpenseAction} className="mt-2">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="yearMonth" value={ym} />
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
      {expenses.length === 0 ? (
        <p className="text-sm text-zinc-500">No expenses this month.</p>
      ) : null}
    </div>
  );
}
