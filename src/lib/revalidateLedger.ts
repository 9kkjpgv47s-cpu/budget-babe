import { revalidatePath } from "next/cache";

export type LedgerRevalidateScope =
  | "overview"
  | "expenses"
  | "bills"
  | "budgets"
  | "import"
  | "insights"
  | "flow"
  | "coach"
  | "tax"
  | "receipts"
  | "plaid";

const ALL_SCOPES: LedgerRevalidateScope[] = [
  "overview",
  "expenses",
  "bills",
  "budgets",
  "import",
  "insights",
  "flow",
  "coach",
  "tax",
  "receipts",
  "plaid",
];

function pathsForScope(scope: LedgerRevalidateScope, yearMonth: string): string[] {
  switch (scope) {
    case "overview":
      return ["/", `/?ym=${yearMonth}`];
    case "expenses":
      return ["/expenses", `/expenses?ym=${yearMonth}`];
    case "bills":
      return ["/bills", `/bills?ym=${yearMonth}`];
    case "budgets":
      return ["/budgets", `/budgets?ym=${yearMonth}`];
    case "import":
      return ["/import", `/import?ym=${yearMonth}`];
    case "insights":
      return ["/insights", `/insights?ym=${yearMonth}`];
    case "flow":
      return ["/flow", `/flow?ym=${yearMonth}`];
    case "coach":
      return ["/coach", `/coach?ym=${yearMonth}`];
    case "tax":
      return [`/tax`, `/tax?year=${yearMonth.slice(0, 4)}`];
    case "receipts":
      return ["/receipts", `/receipts?ym=${yearMonth}`];
    case "plaid":
      return ["/plaid", `/plaid?ym=${yearMonth}`];
    default:
      return [];
  }
}

/**
 * Invalidate views that depend on ledger data. Defaults to core money views only.
 */
export function revalidateLedgerPaths(
  yearMonth: string,
  scopes: LedgerRevalidateScope[] = [
    "overview",
    "expenses",
    "bills",
    "budgets",
    "insights",
    "flow",
    "coach",
  ],
) {
  const unique = new Set<string>();
  for (const scope of scopes) {
    for (const p of pathsForScope(scope, yearMonth)) {
      unique.add(p);
    }
  }
  for (const p of unique) {
    revalidatePath(p);
  }
}

/** Full invalidation (imports, tax workpaper, receipts OCR, plaid). */
export function revalidateLedgerAll(yearMonth: string) {
  revalidateLedgerPaths(yearMonth, ALL_SCOPES);
}
