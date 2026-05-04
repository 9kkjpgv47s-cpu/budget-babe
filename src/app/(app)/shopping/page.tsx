import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { currentYearMonth } from "@/lib/yearMonth";
import { buildShoppingSuggestions, estimateTripCostCents } from "@/lib/shoppingSuggest";
import { deleteTripAction } from "@/app/actions/shopping";
import { TripForm } from "./TripForm";

export default async function ShoppingPage() {
  await requireUser();
  const ym = currentYearMonth();
  const period = await prisma.monthlyPeriod.findUnique({
    where: { yearMonth: ym },
    include: { budgetPlans: true },
  });
  const groceryPlan =
    period?.budgetPlans.find(
      (p) =>
        p.name.toLowerCase().includes("grocer") ||
        (p.category?.toLowerCase().includes("grocer") ?? false),
    ) ?? null;

  const trips = await prisma.shoppingTrip.findMany({
    orderBy: { shoppedAt: "desc" },
    take: 20,
    include: { items: true },
  });

  const { suggested, lastTripItemNames } = await buildShoppingSuggestions(12);
  const estCost = await estimateTripCostCents(suggested.slice(0, 15));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopping memory</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Log each grocery trip with line items. The app remembers what you buy
          often and suggests a list based on trips you did not take yet this
          cycle — items that used to show up regularly but were missing from
          your last trip.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/" className="text-emerald-600 underline">
            ← Overview
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Suggested next list</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Based on your last {Math.min(12, trips.length)} trips. Estimated cost
          for the top suggestions (where prices exist):{" "}
          <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
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
                <span className="text-emerald-600"> — within that budget line.</span>
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
          <p className="mt-2 text-xs text-zinc-500">
            Last trip included: {lastTripItemNames.slice(0, 12).join(", ")}
            {lastTripItemNames.length > 12 ? "…" : ""}
          </p>
        ) : null}
        {suggested.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Log a few trips with overlapping items to unlock suggestions.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {suggested.slice(0, 20).map((s) => (
              <li
                key={s.name}
                className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-zinc-500">
                  {" "}
                  ×{s.suggestedQty}
                  {s.avgPriceCents != null
                    ? ` · ~${formatCents(s.avgPriceCents)} each`
                    : ""}
                </span>
                <div className="text-xs text-zinc-400">
                  Bought on {s.timesPurchased} older trips
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Log a trip</h2>
        <TripForm />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Recent trips</h2>
        <ul className="mt-4 space-y-4">
          {trips.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {t.storeName ?? "Grocery trip"}{" "}
                    <span className="text-sm font-normal text-zinc-500">
                      · {t.shoppedAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm tabular-nums text-zinc-600">
                    Total tracked: {formatCents(t.totalCents)}
                  </div>
                </div>
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
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {t.items.map((i) => (
                  <li key={i.id} className="text-zinc-700 dark:text-zinc-300">
                    {i.name}{" "}
                    <span className="text-zinc-400">
                      ×{i.quantity}
                      {i.priceCents != null
                        ? ` @ ${formatCents(i.priceCents)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {trips.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No trips yet.</p>
        ) : null}
      </section>
    </div>
  );
}
