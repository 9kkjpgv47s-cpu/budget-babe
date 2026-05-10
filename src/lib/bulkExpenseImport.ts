import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";

export type BulkImportRow = {
  date: Date;
  amountCents: number;
  description: string;
  payee: string | null;
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
    const tagsJson = await applyMerchantRulesToTags(parts.description, null);
    await prisma.expense.create({
      data: {
        monthlyPeriodId: period.id,
        userId,
        amountCents: parts.amountCents,
        description: parts.description,
        spentAt: parts.date,
        source,
        importHash: fp,
        payee: parts.payee,
        tagsJson,
      },
    });
    created++;
  }
  return { created, skipped };
}
