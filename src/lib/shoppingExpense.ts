/** Stable dedupe key — one expense per shopping trip per calendar month. */
export function shoppingTripImportHash(tripId: string): string {
  return `shopping-trip:${tripId}`;
}
