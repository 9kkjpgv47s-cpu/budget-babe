"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  detectColumns,
  parseCsvRows,
  rowToExpenseParts,
} from "@/lib/csvImport";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";

function fingerprint(date: Date, amountCents: number, description: string): string {
  const key = `${date.toISOString().slice(0, 10)}|${amountCents}|${description.toLowerCase()}`;
  return createHash("sha256").update(key).digest("hex");
}

export async function importCsvExpensesAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const text = String(formData.get("csvText") ?? "");
  if (!yearMonth || !text.trim()) {
    return { error: "Month and CSV text are required." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const rows = parseCsvRows(text.trim());
  if (rows.length < 2) {
    return { error: "Need a header row and at least one data row." };
  }
  const map = detectColumns(rows[0].map((c) => c.trim()));
  if (map.amount == null && map.debit == null && map.credit == null) {
    return {
      error:
        "Could not find an Amount column (or Debit/Credit). Use headers like Date, Amount, Description.",
    };
  }

  let created = 0;
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const parts = rowToExpenseParts(cells, map);
    if (!parts) {
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
        userId: user.userId,
        amountCents: parts.amountCents,
        description: parts.description,
        spentAt: parts.date,
        source: "csv",
        importHash: fp,
        payee: parts.payee,
        tagsJson,
      },
    });
    created++;
  }

  revalidatePath("/");
  revalidatePath("/import");
  revalidatePath("/insights");
  return {
    ok: true,
    message: `Imported ${created} row(s). Skipped ${skipped} (empty, invalid, or duplicate).`,
  };
}
