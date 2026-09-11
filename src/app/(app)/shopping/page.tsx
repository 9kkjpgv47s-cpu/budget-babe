import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { formatCents } from "@/lib/money";
import { currentYearMonth } from "@/lib/yearMonth";
import { CashFlowSiloCallout } from "@/components/CashFlowSiloCallout";
import {
  buildLastTripPrefill,
  buildShoppingSuggestions,
  buildTypicalStaplePrefill,
  estimateTripCostCents,
} from "@/lib/shoppingSuggest";
import { deleteTripAction, duplicateTripAction } from "@/app/actions/shopping";
import { shoppingTripImportHash } from "@/lib/shoppingExpense";
import { TripForm } from "./TripForm";
import { TripEditForm } from "./TripEditForm";
import { LogTripAsExpenseForm } from "./LogTripAsExpenseForm";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const startFromLast = sp.from === "last";
  const ym =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const period = await getOrCreateMonthlyPeriod(ym);
  const budgetPlans = await prisma.budgetPlan.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const groceryPlanFull = await prisma.budgetPlan.findFirst({
    where: {
      monthlyPeriodId: period.id,
      OR: [
        { name: { contains: "grocer", mode: "insensitive" } },
        { category: { contains: "grocer", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, limitCents: true },
  });
  const groceryPlan = groceryPlanFull;

  const trips = await prisma.shoppingTrip.findMany({
    orderBy: { shoppedAt: "desc" },
    take: 20,
    include: { items: true },
  });

  const { suggested, lastTripItemNames } = await buildShoppingSuggestions(12);
  const [staplesPrefill, lastTripPrefill] = await Promise.all([
    buildTypicalStaplePrefill(15, 35),
    buildLastTripPrefill(),
  ]);
  const estCost = estimateTripCostCents(
    suggested.slice(0, 15).map((s) => ({
      quantity: s.suggestedQty,
      priceCents: s.avgPriceCents,
    })),
  );

  const tripHashes = trips.map((t) => shoppingTripImportHash(t.id));
  const linkedExpenses =
    tripHashes.length > 0
      ? await prisma.expense.findMany({
          where: {
            monthlyPeriodId: period.id,
            importHash: { in: tripHashes },
          },
          select: {
            id: true,
            importHash: true,
            monthlyPeriod: { select: { yearMonth: true } },
          },
        })
      : [];
  const linkedByTripId = new Map(
    linkedExpenses.map((e) => {
      const tripId = e.importHash?.replace(/^shopping-trip:/, "") ?? "";
      return [
        tripId,
        { id: e.id, yearMonth: e.monthlyPeriod.yearMonth },
      ] as const;
    }),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopping memory</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Log trips with line items. The form can pre-fill a <strong>usual basket</strong>{" "}
          from items that repeat across past trips, <strong>repeat your last trip</strong>, or{" "}
          <strong>append suggested picks</strong> you often buy but skipped last time — then
          edit and save.
        </p>
        <p className="mt-2 text-sm">
          <Link href={`/?ym=${ym}`} className="text-accent underline">
            ← Overview ({ym})
          </Link>
        </p>
      </div>

      <CashFlowSiloCallout variant="shopping" yearMonth={ym} />

      <section className="card p-5">
        <h2 className="font-medium">Suggested next list</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your last {Math.min(12, trips.length)} trips. Estimated cost
          for the top suggestions (where prices exist):{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatCents(estCost)}
          </span>
          {groceryPlan ? (
            <>
              {" "}
              · Grocery budget this month:{" "}
              <span className="font-medium tabular-nums">
                {formatCents(groceryPlan.limitCents)}
              </span>
              {estCost > groceryPlan.limitCents ? (
                <span className="text-red-600">
                  {" "}
                  — list is above that budget line; trim rows or split the trip.
                </span>
              ) : (
                <span className="text-accent"> — within that budget line.</span>
              )}
            </>
          ) : (
            <span>
              {" "}
              · Add a budget line named &quot;Groceries&quot; on the overview to
              compare automatically.
            </span>
          )}
        </p>
        {lastTripItemNames.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Last trip included: {lastTripItemNames.slice(0, 12).join(", ")}
            {lastTripItemNames.length > 12 ? "…" : ""}
          </p>
        ) : null}
        {suggested.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Log a few trips with overlapping items to unlock suggestions.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {suggested.slice(0, 20).map((s) => (
              <li
                key={s.name}
                className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-border"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  ×{s.suggestedQty}
                  {s.avgPriceCents != null
                    ? ` · ~${formatCents(s.avgPriceCents)} each`
                    : ""}
                </span>
                <div className="text-xs text-muted-foreground">
                  Bought on {s.timesPurchased} older trips
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-medium">Log a trip</h2>
          {lastTripPrefill.length > 0 ? (
            <Link
              href="/shopping?from=last"
              className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 "
            >
              Start from last trip
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          With history, the form starts as your <strong>usual basket</strong>. Use the
          buttons to swap templates or add suggestions without retyping everything.
        </p>
        <div className="mt-4">
          <TripForm
            staplesPrefill={staplesPrefill}
            lastTripPrefill={lastTripPrefill}
            suggestedItems={suggested}
            startFromLast={startFromLast}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Recent trips</h2>
        <ul className="mt-4 space-y-4">
          {trips.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-border"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {t.storeName ?? "Grocery trip"}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      · {t.shoppedAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    Total tracked: {formatCents(t.totalCents)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={duplicateTripAction}>
                    <input type="hidden" name="tripId" value={t.id} />
                    <button
                      type="submit"
                      className="text-xs text-accent underline hover:no-underline "
                    >
                      Duplicate as new trip
                    </button>
                  </form>
                  <form action={deleteTripAction}>
                  <input type="hidden" name="tripId" value={t.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 underline hover:no-underline"
                  >
                    Delete trip
                  </button>
                </form>
              </div>
              </div>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {t.items.map((i) => (
                    <li key={i.id} className="text-foreground">
                      {i.name}{" "}
                      <span className="text-muted-foreground">
                        ×{i.quantity}
                        {i.priceCents != null
                          ? ` @ ${formatCents(i.priceCents)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <LogTripAsExpenseForm
                  tripId={t.id}
                  totalCents={t.totalCents}
                  yearMonth={format(t.shoppedAt, "yyyy-MM")}
                  budgetPlans={budgetPlans}
                  defaultBudgetPlanId={groceryPlan?.id ?? null}
                  existingExpense={linkedByTripId.get(t.id) ?? null}
                />
                <TripEditForm trip={t} />
            </li>
          ))}
        </ul>
        {trips.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No trips yet.</p>
        ) : null}
      </section>
    </div>
  );
}
