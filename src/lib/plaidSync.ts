import { createHash } from "crypto";
import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getPlaidApi } from "@/lib/plaidClient";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";

export type PlaidSyncResult = {
  imported: number;
  skipped: number;
  pages: number;
};

function importHashPlaid(itemId: string, txnId: string): string {
  return createHash("sha256")
    .update(`plaid|${itemId}|${txnId}`)
    .digest("hex");
}

function ymFromDate(d: Date): string {
  return format(d, "yyyy-MM");
}

/**
 * Pull new posted transactions via `/transactions/sync` and create expenses
 * (deduped by import hash). Skips pending rows.
 */
export async function syncPlaidItemTransactions(
  plaidRowId: string,
  userId: string,
): Promise<PlaidSyncResult> {
  const client = getPlaidApi();
  if (!client) {
    throw new Error("Plaid is not configured (missing PLAID_CLIENT_ID / PLAID_SECRET).");
  }
  const row = await prisma.plaidItem.findUnique({ where: { id: plaidRowId } });
  if (!row) {
    throw new Error("Plaid item not found.");
  }

  let cursor: string | undefined = row.transactionsCursor ?? undefined;
  let imported = 0;
  let skipped = 0;
  let pages = 0;

  for (let i = 0; i < 200; i++) {
    const { data } = await client.transactionsSync({
      access_token: row.accessToken,
      cursor,
    });
    pages += 1;

    for (const t of data.added) {
      if (t.pending) {
        skipped++;
        continue;
      }
      const amountCents = Math.round(Math.abs(Number(t.amount) || 0) * 100);
      if (amountCents <= 0) {
        skipped++;
        continue;
      }
      const dateStr = t.date ?? t.authorized_date;
      if (!dateStr) {
        skipped++;
        continue;
      }
      const spentAt = parseISO(dateStr);
      if (Number.isNaN(spentAt.getTime())) {
        skipped++;
        continue;
      }
      const ym = ymFromDate(spentAt);
      const period = await getOrCreateMonthlyPeriod(ym);
      const fp = importHashPlaid(row.itemId, t.transaction_id);
      const existing = await prisma.expense.findFirst({
        where: { monthlyPeriodId: period.id, importHash: fp },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const description = [t.name, t.merchant_name]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 500) || "Plaid import";
      const payee = t.merchant_name?.trim().slice(0, 200) || null;
      const tagsJson = await applyMerchantRulesToTags(description, null);
      await prisma.expense.create({
        data: {
          monthlyPeriodId: period.id,
          userId,
          amountCents,
          description,
          spentAt,
          source: "plaid",
          importHash: fp,
          payee,
          tagsJson,
        },
      });
      imported++;
    }

    cursor = data.next_cursor ?? undefined;
    await prisma.plaidItem.update({
      where: { id: row.id },
      data: { transactionsCursor: cursor ?? null },
    });

    if (!data.has_more) break;
  }

  return { imported, skipped, pages };
}
