/** Inclusive start, exclusive end in **local** time for calendar `year`. */
export function localCalendarYearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  return { start, end };
}

export function parseTaxYear(raw: string | undefined | null, fallback: number): number {
  const y = raw?.match(/^\d{4}$/) ? parseInt(raw!, 10) : NaN;
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return fallback;
  return y;
}
