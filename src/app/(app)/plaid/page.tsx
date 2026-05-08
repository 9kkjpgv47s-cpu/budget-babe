import { getPlaidApi } from "@/lib/plaidClient";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PlaidConnectSection } from "./PlaidConnectSection";
import { PlaidItemRow } from "./PlaidItemRow";

export default async function PlaidPage() {
  const user = await requireUser();
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
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank sync (Plaid)</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Connect your institution with Plaid Link, then run <strong>Sync transactions</strong> to pull posted
          transactions into this household app as expenses (deduped). Pending transactions are skipped until they
          post.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Connect</h2>
        <PlaidConnectSection configured={configured} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your linked accounts</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No banks linked yet for {user.name}.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <PlaidItemRow
                key={it.id}
                item={{
                  id: it.id,
                  institutionName: it.institutionName,
                  itemId: it.itemId,
                  createdAt: it.createdAt.toISOString(),
                  transactionsCursor: it.transactionsCursor,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        Access tokens are stored in your database — use encryption at rest in production. This integration uses the
        Transactions product and <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/transactions/sync</code>.
      </p>
    </div>
  );
}
