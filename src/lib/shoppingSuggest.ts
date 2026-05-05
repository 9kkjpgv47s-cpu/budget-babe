import { prisma } from "@/lib/prisma";

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export type SuggestedItem = {
  name: string;
  timesPurchased: number;
  suggestedQty: number;
  avgPriceCents: number | null;
};

/** One row to seed the trip form (name, qty, optional unit price). */
export type PrefillLine = {
  name: string;
  quantity: number;
  priceCents: number | null;
};

/**
 * Clone the most recent trip so you can tweak and save (e.g. after this week's shop).
 */
export async function buildLastTripPrefill(): Promise<PrefillLine[]> {
  const latest = await prisma.shoppingTrip.findFirst({
    orderBy: { shoppedAt: "desc" },
    include: { items: true },
  });
  if (!latest?.items.length) return [];
  return latest.items.map((i) => ({
    name: i.name,
    quantity: Math.max(1, i.quantity),
    priceCents: i.priceCents,
  }));
}

/**
 * Items that show up often across recent trips — your "usual" basket.
 * Requires appearing in at least 2 trips when you have 2+ trips of history.
 */
export async function buildTypicalStaplePrefill(
  tripLimit = 15,
  maxItems = 30,
): Promise<PrefillLine[]> {
  const trips = await prisma.shoppingTrip.findMany({
    orderBy: { shoppedAt: "desc" },
    take: tripLimit,
    include: { items: true },
  });

  if (trips.length === 0) return [];

  // Single trip: whole list is the only signal we have
  if (trips.length === 1) {
    return trips[0].items.map((i) => ({
      name: i.name,
      quantity: Math.max(1, i.quantity),
      priceCents: i.priceCents,
    }));
  }

  type Agg = {
    trips: Set<string>;
    qtySum: number;
    displayName: string;
    prices: number[];
  };
  const byKey = new Map<string, Agg>();

  for (const trip of trips) {
    const seenInTrip = new Set<string>();
    for (const item of trip.items) {
      const key = normalizeItemName(item.name);
      if (!key) continue;
      if (seenInTrip.has(key)) continue;
      seenInTrip.add(key);

      let agg = byKey.get(key);
      if (!agg) {
        agg = {
          trips: new Set(),
          qtySum: 0,
          displayName: item.name,
          prices: [],
        };
        byKey.set(key, agg);
      }
      agg.trips.add(trip.id);
      agg.qtySum += item.quantity;
      agg.displayName = item.name;
      if (item.priceCents != null) agg.prices.push(item.priceCents);
    }
  }

  const minTrips = 2;
  const entries = [...byKey.entries()].filter(
    ([, agg]) => agg.trips.size >= minTrips,
  );
  entries.sort((a, b) => {
    if (b[1].trips.size !== a[1].trips.size) {
      return b[1].trips.size - a[1].trips.size;
    }
    const qa = a[1].qtySum / a[1].trips.size;
    const qb = b[1].qtySum / b[1].trips.size;
    return qb - qa;
  });

  const lines: PrefillLine[] = [];
  for (const [, agg] of entries.slice(0, maxItems)) {
    const qty = Math.max(1, Math.round(agg.qtySum / agg.trips.size));
    const avgPrice =
      agg.prices.length > 0
        ? Math.round(agg.prices.reduce((x, y) => x + y, 0) / agg.prices.length)
        : null;
    lines.push({
      name: agg.displayName,
      quantity: qty,
      priceCents: avgPrice,
    });
  }

  return lines;
}

/**
 * From recent trips, suggest items that often appear but were missing from the latest trip.
 */
export async function buildShoppingSuggestions(
  tripLimit = 12,
): Promise<{ suggested: SuggestedItem[]; lastTripItemNames: string[] }> {
  const trips = await prisma.shoppingTrip.findMany({
    orderBy: { shoppedAt: "desc" },
    take: tripLimit,
    include: { items: true },
  });
  if (trips.length === 0) {
    return { suggested: [], lastTripItemNames: [] };
  }

  const [latest, ...older] = trips;
  const lastNames = new Set(
    latest.items.map((i) => normalizeItemName(i.name)),
  );

  const freq = new Map<
    string,
    { count: number; qtySum: number; prices: number[] }
  >();

  for (const trip of older) {
    const seenThisTrip = new Set<string>();
    for (const item of trip.items) {
      const key = normalizeItemName(item.name);
      if (!key) continue;
      if (seenThisTrip.has(key)) continue;
      seenThisTrip.add(key);
      const cur = freq.get(key) ?? { count: 0, qtySum: 0, prices: [] };
      cur.count += 1;
      cur.qtySum += item.quantity;
      if (item.priceCents != null) cur.prices.push(item.priceCents);
      freq.set(key, cur);
    }
  }

  const suggested: SuggestedItem[] = [];
  for (const [name, data] of freq) {
    if (data.count < 2) continue;
    if (lastNames.has(name)) continue;
    const displayName =
      older
        .flatMap((t) => t.items)
        .find((i) => normalizeItemName(i.name) === name)?.name ?? name;
    const avgPrice =
      data.prices.length > 0
        ? Math.round(
            data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
          )
        : null;
    suggested.push({
      name: displayName,
      timesPurchased: data.count,
      suggestedQty: Math.max(1, Math.round(data.qtySum / data.count)),
      avgPriceCents: avgPrice,
    });
  }

  suggested.sort((a, b) => b.timesPurchased - a.timesPurchased);
  return {
    suggested: suggested.slice(0, 30),
    lastTripItemNames: latest.items.map((i) => i.name),
  };
}

export function estimateTripCostCents(
  lines: Pick<PrefillLine, "quantity" | "priceCents">[],
): number {
  return lines.reduce((sum, s) => {
    if (s.priceCents == null) return sum;
    return sum + s.priceCents * s.quantity;
  }, 0);
}
