import { createHash } from "crypto";
import { format, parseISO } from "date-fns";
import type { AccountBase, CreditCardLiability, MortgageLiability, StudentLoan } from "plaid";
import { prisma } from "@/lib/prisma";
import { getPlaidApi } from "@/lib/plaidClient";
import { decryptAccessToken } from "@/lib/plaidToken";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { applyMerchantRulesToTags } from "@/lib/merchantRules";

export type PlaidSyncResult = {
  imported: number;
  updated: number;
  removed: number;
  skipped: number;
  skippedPending: number;
  /** Money coming in (paychecks, refunds, transfers in) — income stays manual via Paychecks */
  skippedInflow: number;
  /** Own-account transfers / loan payments — skipping avoids double counting */
  skippedTransfer: number;
  /** Rows on accounts the user excluded from expense import */
  skippedExcludedAccount: number;
  accounts: number;
  liabilities: number;
  netWorth: number;
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

function toCents(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 100);
}

/** Plaid category groups that represent moving money between your own accounts. */
function isOwnAccountTransfer(t: { personal_finance_category?: { primary?: string } | null }): boolean {
  const p = t.personal_finance_category?.primary;
  return p === "TRANSFER_IN" || p === "TRANSFER_OUT" || p === "LOAN_PAYMENTS";
}

/** Upsert Plaid's account list for an item; keeps per-account toggles across re-links. */
async function refreshAccounts(
  plaidRowId: string,
  itemId: string,
  institutionName: string | null,
  accounts: AccountBase[],
): Promise<Map<string, { syncToExpenses: boolean }>> {
  const toggles = new Map<string, { syncToExpenses: boolean }>();
  for (const a of accounts) {
    const row = await prisma.plaidAccount.upsert({
      where: { accountId: a.account_id },
      create: {
        plaidItemId: plaidRowId,
        accountId: a.account_id,
        name: a.name || "Account",
        officialName: a.official_name ?? null,
        mask: a.mask ?? null,
        type: String(a.type ?? "other"),
        subtype: a.subtype ? String(a.subtype) : null,
        currentBalanceCents: toCents(a.balances?.current),
        availableBalanceCents: toCents(a.balances?.available),
        currency: a.balances?.iso_currency_code ?? a.balances?.unofficial_currency_code ?? null,
      },
      update: {
        plaidItemId: plaidRowId,
        name: a.name || "Account",
        officialName: a.official_name ?? null,
        mask: a.mask ?? null,
        type: String(a.type ?? "other"),
        subtype: a.subtype ? String(a.subtype) : null,
        currentBalanceCents: toCents(a.balances?.current),
        availableBalanceCents: toCents(a.balances?.available),
        currency: a.balances?.iso_currency_code ?? a.balances?.unofficial_currency_code ?? null,
      },
    });
    toggles.set(a.account_id, { syncToExpenses: row.syncToExpenses });
    await upsertNetWorthAccount(institutionName, a);
  }
  return toggles;
}

const LIABILITY_TYPES = new Set(["credit", "loan"]);

/** Every linked account becomes an auto-updating net worth row (asset or liability). */
async function upsertNetWorthAccount(institutionName: string | null, a: AccountBase): Promise<void> {
  const cents = toCents(a.balances?.current);
  if (cents == null) return;
  const label = `${institutionName ? institutionName + " " : ""}${a.name}${a.mask ? " ··" + a.mask : ""}`.slice(0, 200);
  const kind = LIABILITY_TYPES.has(String(a.type)) ? "liability" : "asset";
  const existing = await prisma.netWorthAccount.findUnique({ where: { plaidAccountId: a.account_id } });
  if (existing) {
    await prisma.netWorthAccount.update({
      where: { plaidAccountId: a.account_id },
      data: { kind, balanceCents: cents, note: "Auto from Plaid sync" },
    });
  } else {
    await prisma.netWorthAccount.create({
      data: {
        plaidAccountId: a.account_id,
        kind,
        name: label,
        balanceCents: cents,
        note: "Auto from Plaid sync",
      },
    });
  }
}

function creditApr(c: CreditCardLiability): number | null {
  const aprs = c.aprs ?? [];
  const purchase = aprs.find((x) => x.apr_type === "purchase_apr") ?? aprs[0];
  return purchase?.apr_percentage ?? null;
}

/** Plaid Liabilities → DebtAccount rows (credit cards, mortgages, student/other loans). */
async function syncLiabilities(accessToken: string, institutionName: string | null): Promise<number> {
  const client = getPlaidApi();
  if (!client) return 0;
  const { data } = await client.liabilitiesGet({ access_token: accessToken });
  const balances = new Map(
    (data.accounts ?? []).map((a) => [a.account_id, toCents(a.balances?.current)]),
  );
  let count = 0;
  const upsert = async (accountId: string | null | undefined, name: string, minCents: number | null, apr: number | null) => {
    if (!accountId) return;
    const cents = balances.get(accountId) ?? 0;
    const existing = await prisma.debtAccount.findUnique({ where: { plaidAccountId: accountId } });
    const data = { balanceCents: cents, minimumPaymentCents: minCents, aprPercent: apr };
    if (existing) {
      await prisma.debtAccount.update({ where: { plaidAccountId: accountId }, data });
    } else {
      await prisma.debtAccount.create({
        data: { ...data, plaidAccountId: accountId, name: name.slice(0, 200), note: "Auto from Plaid sync" },
      });
    }
    count++;
  };
  for (const c of data.liabilities?.credit ?? []) {
    const acct = (data.accounts ?? []).find((a) => a.account_id === c.account_id);
    await upsert(
      c.account_id,
      `${institutionName ? institutionName + " " : ""}${acct?.name ?? "Credit card"}${acct?.mask ? " ··" + acct.mask : ""}`,
      toCents(c.minimum_payment_amount),
      creditApr(c),
    );
  }
  for (const m of data.liabilities?.mortgage ?? ([] as MortgageLiability[])) {
    const acct = (data.accounts ?? []).find((a) => a.account_id === m.account_id);
    await upsert(
      m.account_id,
      `${institutionName ? institutionName + " " : ""}${acct?.name ?? "Mortgage"}${acct?.mask ? " ··" + acct.mask : ""}`,
      toCents(m.next_monthly_payment),
      m.interest_rate?.percentage ?? null,
    );
  }
  for (const s of data.liabilities?.student ?? ([] as StudentLoan[])) {
    const acct = (data.accounts ?? []).find((a) => a.account_id === s.account_id);
    await upsert(
      s.account_id,
      `${institutionName ? institutionName + " " : ""}${acct?.name ?? "Student loan"}${acct?.mask ? " ··" + acct.mask : ""}`,
      toCents(s.minimum_payment_amount),
      s.interest_rate_percentage ?? null,
    );
  }
  return count;
}

/**
 * Pull transaction updates via `/transactions/sync` (added + modified + removed),
 * refresh account balances, auto-fill net worth rows, and pull liabilities into
 * Debt when the Item has that product. Posted outflows only — inflows and
 * own-account transfers are counted but never become expenses.
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
  const accessToken = decryptAccessToken(row.accessToken);

  // Keep the item's webhook registration pointed at the configured endpoint.
  const webhookUrl = process.env.PLAID_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      await client.itemWebhookUpdate({ access_token: accessToken, webhook: webhookUrl });
    } catch {
      // Non-fatal: webhook registration is best-effort.
    }
  }

  const result: PlaidSyncResult = {
    imported: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
    skippedPending: 0,
    skippedInflow: 0,
    skippedTransfer: 0,
    skippedExcludedAccount: 0,
    accounts: 0,
    liabilities: 0,
    netWorth: 0,
    pages: 0,
  };

  let cursor: string | undefined = row.transactionsCursor ?? undefined;
  const initialCursor = cursor;
  let accountToggles = new Map<string, { syncToExpenses: boolean }>();
  let restarted = false;

  // Plaid can return TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION if the item
  // mutated mid-page; restart once from the original cursor per Plaid docs.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      for (let i = 0; i < 200; i++) {
        const { data } = await client.transactionsSync({
          access_token: accessToken,
          cursor,
        });
        result.pages += 1;

        if (data.accounts?.length && accountToggles.size === 0) {
          accountToggles = await refreshAccounts(row.id, row.itemId, row.institutionName, data.accounts);
          result.accounts = data.accounts.length;
        }

        for (const t of data.added) {
          if (t.pending) {
            result.skippedPending++;
            continue;
          }
          const toggle = t.account_id ? accountToggles.get(t.account_id) : undefined;
          if (toggle && !toggle.syncToExpenses) {
            result.skippedExcludedAccount++;
            continue;
          }
          const amount = Number(t.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            result.skippedInflow++;
            continue;
          }
          if (isOwnAccountTransfer(t)) {
            result.skippedTransfer++;
            continue;
          }
          const dateStr = t.date ?? t.authorized_date;
          const spentAt = dateStr ? parseISO(dateStr) : null;
          if (!spentAt || Number.isNaN(spentAt.getTime())) {
            result.skipped++;
            continue;
          }
          const period = await getOrCreateMonthlyPeriod(ymFromDate(spentAt));
          const fp = importHashPlaid(row.itemId, t.transaction_id);
          const existing = await prisma.expense.findFirst({ where: { importHash: fp } });
          if (existing) {
            result.skipped++;
            continue;
          }
          const description =
            [t.name, t.merchant_name].filter(Boolean).join(" — ").slice(0, 500) || "Plaid import";
          const payee = t.merchant_name?.trim().slice(0, 200) || null;
          const tagsJson = await applyMerchantRulesToTags(description, null);
          await prisma.expense.create({
            data: {
              monthlyPeriodId: period.id,
              userId,
              amountCents: Math.round(amount * 100),
              description,
              spentAt,
              source: "plaid",
              importHash: fp,
              payee,
              tagsJson,
            },
          });
          result.imported++;
        }

        for (const t of data.modified) {
          if (t.pending) continue;
          const fp = importHashPlaid(row.itemId, t.transaction_id);
          const existing = await prisma.expense.findFirst({ where: { importHash: fp } });
          if (!existing) continue;
          const amount = Number(t.amount);
          const dateStr = t.date ?? t.authorized_date;
          const spentAt = dateStr ? parseISO(dateStr) : null;
          if (!Number.isFinite(amount) || amount <= 0 || !spentAt || Number.isNaN(spentAt.getTime())) {
            await prisma.expense.delete({ where: { id: existing.id } });
            result.removed++;
            continue;
          }
          const period = await getOrCreateMonthlyPeriod(ymFromDate(spentAt));
          const description =
            [t.name, t.merchant_name].filter(Boolean).join(" — ").slice(0, 500) || existing.description;
          await prisma.expense.update({
            where: { id: existing.id },
            data: {
              amountCents: Math.round(amount * 100),
              description,
              spentAt,
              monthlyPeriodId: period.id,
              payee: t.merchant_name?.trim().slice(0, 200) || existing.payee,
            },
          });
          result.updated++;
        }

        for (const r of data.removed) {
          const fp = importHashPlaid(row.itemId, r.transaction_id);
          const del = await prisma.expense.deleteMany({ where: { importHash: fp } });
          result.removed += del.count;
        }

        cursor = data.next_cursor ?? undefined;
        await prisma.plaidItem.update({
          where: { id: row.id },
          data: { transactionsCursor: cursor ?? null },
        });

        if (!data.has_more) break;
      }
      break;
    } catch (e) {
      const code = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" && !restarted) {
        restarted = true;
        cursor = initialCursor;
        continue;
      }
      const msg = e instanceof Error ? e.message : "Sync failed";
      await prisma.plaidItem.update({
        where: { id: row.id },
        data: { lastSyncError: msg.slice(0, 500) },
      });
      throw e;
    }
  }

  // Optional product: liabilities (credit APRs, loan minimums) → Debt page.
  try {
    result.liabilities = await syncLiabilities(accessToken, row.institutionName);
  } catch {
    // Item may not have the Liabilities product — debt stays manual.
  }
  result.netWorth = await prisma.netWorthAccount.count({
    where: { plaidAccountId: { not: null } },
  });

  await prisma.plaidItem.update({
    where: { id: row.id },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });

  result.skipped += result.skippedPending + result.skippedInflow + result.skippedTransfer + result.skippedExcludedAccount;
  return result;
}
