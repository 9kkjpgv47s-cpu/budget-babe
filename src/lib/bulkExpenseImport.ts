import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import {
  finalizeExpenseForWrite,
  getLastExpenseDefaultsForYearMonth,
} from "@/lib/entryDefaults";

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
  const [lastDefaults, existingHashes, categories] = await Promise.all([
    getLastExpenseDefaultsForYearMonth(yearMonth),
    prisma.expense.findMany({
      where: { monthlyPeriodId: period.id, importHash: { not: null } },
      select: { importHash: true },
    }),
    prisma.category.findMany({
      select: { id: true, slug: true, name: true },
    }),
  ]);

  const hashSet = new Set(
    existingHashes.map((e) => e.importHash).filter(Boolean) as string[],
  );
  const categoryBySlug = new Map(
    categories.map((c) => [c.slug.toLowerCase(), c.id]),
  );
  const categoryByName = new Map(
    categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
  );

  const toCreate: {
    monthlyPeriodId: string;
    userId: string;
    amountCents: number;
    description: string;
    spentAt: Date;
    source: string;
    importHash: string;
    payee: string | null;
    categoryId: string | null;
    budgetPlanId: string | null;
    taxCategory: string | null;
    tagsJson: string | null;
  }[] = [];

  let skipped = 0;

  for (const parts of rows) {
    if (!parts.description || parts.amountCents <= 0) {
      skipped++;
      continue;
    }
    const fp = fingerprint(parts.date, parts.amountCents, parts.description);
    if (hashSet.has(fp)) {
      skipped++;
      continue;
    }
    hashSet.add(fp);

    let categoryId: string | null = null;
    if (parts.categoryLabel?.trim()) {
      const label = parts.categoryLabel.trim().toLowerCase();
      categoryId =
        categoryBySlug.get(label) ??
        categoryByName.get(label) ??
        null;
    }

    const fields = await finalizeExpenseForWrite(
      {
        description: parts.description,
        tagsJson: lastDefaults.tagsJson,
        budgetPlanId: lastDefaults.budgetPlanId,
        payee: parts.payee ?? lastDefaults.payee,
        categoryId,
      },
      yearMonth,
    );

    toCreate.push({
      monthlyPeriodId: period.id,
      userId,
      amountCents: parts.amountCents,
      description: parts.description,
      spentAt: parts.date,
      source,
      importHash: fp,
      payee: fields.payee,
      categoryId: fields.categoryId,
      budgetPlanId: fields.budgetPlanId,
      taxCategory: fields.taxCategory,
      tagsJson: fields.tagsJson,
    });
  }

  const CHUNK = 100;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.expense.createMany({ data: toCreate.slice(i, i + CHUNK) });
  }

  return { created: toCreate.length, skipped };
}
