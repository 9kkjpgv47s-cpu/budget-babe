import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { resolveCategoryIdFromLabel } from "@/lib/categories";
import { getLastExpenseDefaultsForYearMonth } from "@/lib/entryDefaults";
import { finalizeClassifiedExpenseWrite } from "@/lib/expenseWrite";

export type BulkImportRow = {
  date: Date;
  amountCents: number;
  description: string;
  payee: string | null;
  categoryLabel?: string | null;
};

function fingerprint(date: Date, amountCents: number, description: string): string {
  const key = `${date.toISOString().slice(0, 10)}|${amountCents}|${description.toLowerCase()}`;
  return createHash("sha256").update(key).digest("hex");
}

export async function bulkInsertExpenses(
  rows: BulkImportRow[],
  yearMonth: string,
  userId: string,
  source: "csv" | "ofx" | "qif",
): Promise<{ created: number; skipped: number }> {
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const lastDefaults = await getLastExpenseDefaultsForYearMonth(yearMonth);
  let created = 0;
  let skipped = 0;
  for (const parts of rows) {
    if (!parts.description || parts.amountCents <= 0) {
      skipped++;
      continue;
    }
    const fp = fingerprint(parts.date, parts.amountCents, parts.description);
    const existing = await prisma.expense.findFirst({
      where: { monthlyPeriodId: period.id, importHash: fp },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const categoryId = await resolveCategoryIdFromLabel(parts.categoryLabel);
    const write = await finalizeClassifiedExpenseWrite(
      {
        description: parts.description,
        tagsJson: lastDefaults.tagsJson,
        budgetPlanId: lastDefaults.budgetPlanId,
        payee: parts.payee ?? lastDefaults.payee,
      },
      period.id,
      yearMonth,
      { categoryId },
    );
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId,
        amountCents: parts.amountCents,
        description: parts.description,
        spentAt: parts.date,
        source,
        importHash: fp,
        payee: write.payee,
        categoryId: write.categoryId,
        budgetPlanId: write.budgetPlanId,
        taxCategory: write.taxCategory,
        tagsJson: write.tagsJson,
      },
    });
    created++;
  }
  return { created, skipped };
}
