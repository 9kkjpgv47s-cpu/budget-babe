import { getPlaidApi } from "@/lib/plaidClient";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { currentYearMonth } from "@/lib/yearMonth";
import { PlaidConnectSection } from "./PlaidConnectSection";
import { PlaidItemRow } from "./PlaidItemRow";
import { PlaidMonthNote } from "./PlaidMonthNote";
import { PlaidSyncAllButton } from "./PlaidSyncAllButton";

export default async function PlaidPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const configured = getPlaidApi() !== null;
  const items = await prisma.plaidItem.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      institutionName: true,
      itemId: true,
      createdAt: true,
      transactionsCursor: true,
      lastSyncAt: true,
      lastSyncError: true,
      accounts: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          mask: true,
          type: true,
          subtype: true,
          currentBalanceCents: true,
          syncToExpenses: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank sync (Plaid)</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Connect your institution with Plaid Link, then sync pulls posted transactions into expenses
          (deduped), refreshes account balances into <strong>Net worth</strong>, and fills{" "}
          <strong>Debt</strong> when the Liabilities product is enabled. Deposits, refunds, and
          transfers between your own accounts are never imported as spending.
        </p>
      </div>

      <PlaidMonthNote yearMonth={yearMonth} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Connect</h2>
        <PlaidConnectSection configured={configured} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Your linked accounts</h2>
          {items.length > 1 ? <PlaidSyncAllButton /> : null}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No banks linked yet for {user.name}.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <PlaidItemRow
                key={it.id}
                yearMonth={yearMonth}
                item={{
                  id: it.id,
                  institutionName: it.institutionName,
                  itemId: it.itemId,
                  createdAt: it.createdAt.toISOString(),
                  transactionsCursor: it.transactionsCursor,
                  lastSyncAt: it.lastSyncAt?.toISOString() ?? null,
                  lastSyncError: it.lastSyncError,
                  accounts: it.accounts,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        Access tokens are AES-256-GCM encrypted at rest when <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">PLAID_TOKEN_ENC_KEY</code>{" "}
        is set. Auto-sync runs on Plaid webhooks when{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">PLAID_WEBHOOK_URL</code> is set
        (e.g. <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">https://your-app.vercel.app/api/plaid/webhook</code>).
        New links request 24 months of history.
      </p>
    </div>
  );
}
