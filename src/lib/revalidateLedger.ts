import { revalidatePath } from "next/cache";

/** Invalidate views that depend on expense ledger changes. */
export function revalidateLedgerPaths(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
  revalidatePath("/import");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
  revalidatePath("/tax");
  revalidatePath("/receipts");
}
