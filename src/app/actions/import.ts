"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  detectColumns,
  mergeColumnMaps,
  parseCsvRows,
  rowToExpenseParts,
} from "@/lib/csvImport";
import { parseOfxTransactions } from "@/lib/ofxParse";
import { parseQifTransactions } from "@/lib/qifParse";
import { bulkInsertExpenses } from "@/lib/bulkExpenseImport";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";

function rev(yearMonth: string) {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/bills");
  revalidatePath("/import");
  revalidatePath("/insights");
  revalidatePath("/flow");
  revalidatePath("/coach");
  revalidatePath("/expenses");
  revalidatePath(`/expenses?ym=${yearMonth}`);
}

export async function importCsvExpensesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const text = String(formData.get("csvText") ?? "");
  const columnMapJson = String(formData.get("columnMapJson") ?? "").trim();
  if (!yearMonth || !text.trim()) {
    return { error: "Month and CSV text are required." };
  }
  await getOrCreateMonthlyPeriod(yearMonth);
  const rows = parseCsvRows(text.trim());
  if (rows.length < 2) {
    return { error: "Need a header row and at least one data row." };
  }
  let map = detectColumns(rows[0].map((c) => c.trim()));
  map = mergeColumnMaps(map, columnMapJson || null);
  if (map.amount == null && map.debit == null && map.credit == null) {
    return {
      error:
        "Could not find amount columns. Set column map JSON or use headers Date, Amount, Description.",
    };
  }
  const bulk: { date: Date; amountCents: number; description: string; payee: string | null }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const parts = rowToExpenseParts(rows[r], map);
    if (parts) bulk.push(parts);
  }
  const { created, skipped } = await bulkInsertExpenses(bulk, yearMonth, user.userId, "csv");
  rev(yearMonth);
  return {
    ok: true,
    message: `Imported ${created} row(s). Skipped ${skipped} (empty, invalid, or duplicate).`,
  };
}

export async function importOfxExpensesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const text = String(formData.get("ofxText") ?? "");
  if (!yearMonth || !text.trim()) {
    return { error: "Month and OFX content are required." };
  }
  await getOrCreateMonthlyPeriod(yearMonth);
  const bulk = parseOfxTransactions(text);
  if (bulk.length === 0) {
    return { error: "No STMTTRN transactions found in OFX." };
  }
  const { created, skipped } = await bulkInsertExpenses(bulk, yearMonth, user.userId, "ofx");
  rev(yearMonth);
  return {
    ok: true,
    message: `Imported ${created} OFX row(s). Skipped ${skipped}.`,
  };
}

export async function importQifExpensesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const text = String(formData.get("qifText") ?? "");
  if (!yearMonth || !text.trim()) {
    return { error: "Month and QIF content are required." };
  }
  await getOrCreateMonthlyPeriod(yearMonth);
  const bulk = parseQifTransactions(text);
  if (bulk.length === 0) {
    return { error: "No QIF transactions parsed." };
  }
  const { created, skipped } = await bulkInsertExpenses(bulk, yearMonth, user.userId, "qif");
  rev(yearMonth);
  return {
    ok: true,
    message: `Imported ${created} QIF row(s). Skipped ${skipped}.`,
  };
}
