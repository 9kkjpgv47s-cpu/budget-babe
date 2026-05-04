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

export async function estimateTripCostCents(suggested: SuggestedItem[]) {
  return suggested.reduce((sum, s) => {
    if (s.avgPriceCents == null) return sum;
    return sum + s.avgPriceCents * s.suggestedQty;
  }, 0);
}
