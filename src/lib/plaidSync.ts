import { createHash } from "crypto";
import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getPlaidApi } from "@/lib/plaidClient";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import {
  applyMerchantRulesToTagsSync,
  loadMerchantRules,
} from "@/lib/merchantRules";
import {
  getPlaidAccessToken,
  storePlaidAccessToken,
} from "@/lib/plaidStorage";
import { isEncryptedToken } from "@/lib/tokenEncryption";

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

  let accessTokenStored = row.accessToken;
  if (!isEncryptedToken(accessTokenStored)) {
    accessTokenStored = storePlaidAccessToken(accessTokenStored);
    await prisma.plaidItem.update({
      where: { id: row.id },
      data: { accessToken: accessTokenStored },
    });
  }
  const accessToken = getPlaidAccessToken(accessTokenStored);
  const rules = await loadMerchantRules();

  let cursor: string | undefined = row.transactionsCursor ?? undefined;
  let imported = 0;
  let skipped = 0;
  let pages = 0;

  const periodCache = new Map<string, string>();
  const hashCache = new Map<string, Set<string>>();

  async function periodIdForYm(ym: string): Promise<string> {
    const cached = periodCache.get(ym);
    if (cached) return cached;
    const period = await getOrCreateMonthlyPeriod(ym);
    periodCache.set(ym, period.id);
    return period.id;
  }

  async function hashSetForPeriod(periodId: string): Promise<Set<string>> {
    let set = hashCache.get(periodId);
    if (set) return set;
    const rows = await prisma.expense.findMany({
      where: { monthlyPeriodId: periodId, importHash: { not: null } },
      select: { importHash: true },
    });
    set = new Set(
      rows.map((r) => r.importHash).filter(Boolean) as string[],
    );
    hashCache.set(periodId, set);
    return set;
  }

  const pendingCreates: {
    monthlyPeriodId: string;
    userId: string;
    amountCents: number;
    description: string;
    spentAt: Date;
    source: string;
    importHash: string;
    payee: string | null;
    tagsJson: string | null;
  }[] = [];

  for (let i = 0; i < 200; i++) {
    const { data } = await client.transactionsSync({
      access_token: accessToken,
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
      const periodId = await periodIdForYm(ym);
      const fp = importHashPlaid(row.itemId, t.transaction_id);
      const hashes = await hashSetForPeriod(periodId);
      if (hashes.has(fp)) {
        skipped++;
        continue;
      }
      hashes.add(fp);

      const description = [t.name, t.merchant_name]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 500) || "Plaid import";
      const payee = t.merchant_name?.trim().slice(0, 200) || null;
      const tagsJson = applyMerchantRulesToTagsSync(description, null, rules);

      pendingCreates.push({
        monthlyPeriodId: periodId,
        userId,
        amountCents,
        description,
        spentAt,
        source: "plaid",
        importHash: fp,
        payee,
        tagsJson,
      });
    }

    cursor = data.next_cursor ?? undefined;

    if (!data.has_more) break;
  }

  const CHUNK = 100;
  for (let i = 0; i < pendingCreates.length; i += CHUNK) {
    await prisma.expense.createMany({
      data: pendingCreates.slice(i, i + CHUNK),
    });
  }
  imported = pendingCreates.length;

  await prisma.plaidItem.update({
    where: { id: row.id },
    data: { transactionsCursor: cursor ?? null },
  });

  return { imported, skipped, pages };
}
