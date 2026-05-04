import { format, parseISO, startOfMonth } from "date-fns";

export function currentYearMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export function toYearMonth(d: Date): string {
  return format(startOfMonth(d), "yyyy-MM");
}

export function parseYearMonth(ym: string): Date {
  return startOfMonth(parseISO(`${ym}-01`));
}
