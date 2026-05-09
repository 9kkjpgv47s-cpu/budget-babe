"use client";

import { useMemo, useState } from "react";
import { formatCents } from "@/lib/money";

type TrendSlice = {
  label: string;
  spent: number;
  unpaidBills: number;
  expectedGroceries: number;
  circulation: number;
};

type TrendMonth = {
  yearMonth: string;
  incomeCents: number;
  spentTotal: number;
  unpaidBillsTotal: number;
  expectedGroceriesMonthCents: number;
  projectedCirculationCents: number;
  slices: TrendSlice[];
};

type CalendarExpense = {
  id: string;
  amountCents: number;
  spentAtIso: string;
  budgetPlanId: string | null;
};

type CalendarMonth = {
  yearMonth: string;
  expenses: CalendarExpense[];
};

type BudgetPlanOption = {
  id: string;
  name: string;
  category: string | null;
};

function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(y, (m || 1) - 1, 1);
}

function monthDays(ym: string): number {
  const d = parseYearMonth(ym);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function firstWeekday(ym: string): number {
  return parseYearMonth(ym).getDay();
}

function sumCents(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function semanticToneForValue(value: number): {
  text: string;
  pill: string;
} {
  if (value < 0) {
    return {
      text: "text-red-600 dark:text-red-400",
      pill: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    };
  }
  if (value === 0) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  return {
    text: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
}

function filterCalendarExpenses(
  expenses: CalendarExpense[],
  budgetPlanById: Map<string, BudgetPlanOption>,
  selectedPlanId: string,
  selectedCategory: string,
): CalendarExpense[] {
  return expenses.filter((e) => {
    if (!e.budgetPlanId) {
      return selectedPlanId === "all" && selectedCategory === "all";
    }
    if (selectedPlanId !== "all" && e.budgetPlanId !== selectedPlanId) return false;
    if (selectedCategory !== "all") {
      const category = budgetPlanById.get(e.budgetPlanId)?.category ?? "";
      if (category !== selectedCategory) return false;
    }
    return true;
  });
}

function longestSpendStreak(expenses: CalendarExpense[], ym: string): number {
  const activeDays = new Set<number>();
  for (const e of expenses) {
    const d = new Date(e.spentAtIso);
    activeDays.add(d.getDate());
  }
  const days = monthDays(ym);
  let best = 0;
  let run = 0;
  for (let day = 1; day <= days; day++) {
    if (activeDays.has(day)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function HomeMobileInsights({
  trendMonths,
  calendarMonths,
  budgetPlanOptions,
}: {
  trendMonths: TrendMonth[];
  calendarMonths: CalendarMonth[];
  budgetPlanOptions: BudgetPlanOption[];
}) {
  const [trendIdx, setTrendIdx] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const budgetPlanById = useMemo(
    () => new Map(budgetPlanOptions.map((o) => [o.id, o])),
    [budgetPlanOptions],
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set(budgetPlanOptions.map((o) => o.category).filter(Boolean) as string[]),
      ).sort(),
    [budgetPlanOptions],
  );

  const selectedTrend = trendMonths[Math.max(0, Math.min(trendMonths.length - 1, trendIdx))];
  const barMax = Math.max(
    1,
    ...selectedTrend.slices.flatMap((s) => [
      s.spent,
      s.unpaidBills,
      s.expectedGroceries,
      Math.max(0, s.circulation),
    ]),
  );

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              $
            </span>
            Two-week trend
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Projected end-of-period cash included
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {trendMonths.map((m, idx) => (
            <button
              key={m.yearMonth}
              type="button"
              onClick={() => setTrendIdx(idx)}
              className={`min-h-10 rounded-lg border px-2 py-1 text-xs font-semibold transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none ${
                idx === trendIdx
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              }`}
            >
              {m.yearMonth}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto scroll-smooth">
          <div className="flex snap-x snap-mandatory gap-3 pb-1">
            {selectedTrend.slices.map((slice) => (
              <div
                key={slice.label}
                className="min-w-[88%] snap-start rounded-xl border border-zinc-200 bg-zinc-50 p-3 transition-shadow duration-200 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-950 sm:min-w-[48%]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{slice.label}</div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      semanticToneForValue(slice.circulation).pill
                    }`}
                  >
                    {slice.circulation > 0
                      ? "Healthy"
                      : slice.circulation < 0
                        ? "Overspend risk"
                        : "Break-even"}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  <TrendBar label="Spent" value={slice.spent} max={barMax} color="bg-rose-500" />
                  <TrendBar
                    label="Bills to pay"
                    value={slice.unpaidBills}
                    max={barMax}
                    color="bg-amber-500"
                  />
                  <TrendBar
                    label="Expected groceries"
                    value={slice.expectedGroceries}
                    max={barMax}
                    color="bg-emerald-500"
                  />
                  <TrendBar
                    label="Circulation left"
                    value={Math.max(0, slice.circulation)}
                    max={barMax}
                    color="bg-sky-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {selectedTrend.slices.map((slice) => (
            <span
              key={`dot-${slice.label}`}
              className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700"
            />
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-300">Income</span>
            <span className="tabular-nums">{formatCents(selectedTrend.incomeCents)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-300">
              Projected cash after spending plan
            </span>
            <span
              className={`tabular-nums font-semibold ${
                semanticToneForValue(selectedTrend.projectedCirculationCents).text
              }`}
            >
              {formatCents(selectedTrend.projectedCirculationCents)}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            C
          </span>
          Spending calendar habits
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Filter by budget line/category and review spending streaks by month.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Budget line
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All budget lines</option>
              {budgetPlanOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Category
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {calendarMonths.map((m) => {
            const filtered = filterCalendarExpenses(
              m.expenses,
              budgetPlanById,
              selectedPlanId,
              selectedCategory,
            );
            const streak = longestSpendStreak(filtered, m.yearMonth);
            return (
              <MonthCalendarCard
                key={m.yearMonth}
                yearMonth={m.yearMonth}
                expenses={filtered}
                longestStreak={streak}
              />
            );
          })}
        </div>
      </section>
    </>
  );
}

function TrendBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const width = Math.max(2, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="tabular-nums">{formatCents(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${color} transition-all duration-300 motion-reduce:transition-none`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function MonthCalendarCard({
  yearMonth,
  expenses,
  longestStreak,
}: {
  yearMonth: string;
  expenses: CalendarExpense[];
  longestStreak: number;
}) {
  const first = firstWeekday(yearMonth);
  const days = monthDays(yearMonth);
  const totals = new Map<number, number>();
  for (const e of expenses) {
    const day = new Date(e.spentAtIso).getDate();
    totals.set(day, (totals.get(day) ?? 0) + e.amountCents);
  }
  const monthTotal = sumCents([...totals.values()]);

  return (
    <div className="rounded-xl border border-zinc-200 p-3 transition-shadow duration-200 hover:shadow-sm dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{yearMonth}</h3>
        <span className="text-xs tabular-nums text-zinc-500">{formatCents(monthTotal)}</span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-500">
        Longest streak:{" "}
        <span
          className={`font-semibold ${
            longestStreak >= 4
              ? "text-red-600 dark:text-red-400"
              : longestStreak >= 2
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {longestStreak} day(s)
        </span>
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
          <div key={`${d}-${idx}`}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: first }).map((_, idx) => (
          <div key={`blank-${idx}`} />
        ))}
        {Array.from({ length: days }).map((_, idx) => {
          const day = idx + 1;
          const spent = totals.get(day) ?? 0;
          return (
            <div
              key={day}
              className={`rounded border p-1 text-center text-[10px] ${
                spent > 0
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="font-medium">{day}</div>
              <div className="truncate tabular-nums text-[9px] text-zinc-500">
                {spent > 0 ? formatCents(spent) : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
