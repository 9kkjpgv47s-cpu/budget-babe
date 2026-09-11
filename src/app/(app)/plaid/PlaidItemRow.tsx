"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  disconnectPlaidItemAction,
  syncPlaidItemAction,
  togglePlaidAccountSyncAction,
} from "@/app/actions/plaid";
import { formatCents } from "@/lib/money";
import { currentYearMonth } from "@/lib/yearMonth";

type Account = {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalanceCents: number | null;
  syncToExpenses: boolean;
};

type Row = {
  id: string;
  institutionName: string | null;
  itemId: string;
  createdAt: string;
  transactionsCursor: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  accounts: Account[];
};

export function PlaidItemRow({
  item,
  yearMonth = currentYearMonth(),
}: {
  item: Row;
  yearMonth?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [lastImported, setLastImported] = useState<number | null>(null);

  function sync() {
    setMsg(null);
    setLastImported(null);
    start(async () => {
      const r = await syncPlaidItemAction(item.id);
      if (r.ok) {
        setLastImported(r.imported);
        const parts = [`Imported ${r.imported} new`];
        if (r.updated > 0) parts.push(`${r.updated} updated`);
        if (r.removed > 0) parts.push(`${r.removed} removed`);
        if (r.skippedPending > 0) parts.push(`${r.skippedPending} still pending`);
        if (r.skippedInflow > 0) parts.push(`${r.skippedInflow} deposit/refund`);
        if (r.skippedTransfer > 0) parts.push(`${r.skippedTransfer} transfer`);
        if (r.skippedExcludedAccount > 0) parts.push(`${r.skippedExcludedAccount} on excluded accounts`);
        parts.push(`${r.pages} page(s)`);
        setMsg(
          (r.imported > 0 ? parts.join(", ") + ". Assign budgets on Expenses." : parts.join(", ") + "."),
        );
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function toggleAccount(accountId: string, syncToExpenses: boolean) {
    start(async () => {
      const r = await togglePlaidAccountSyncAction(accountId, syncToExpenses);
      if (r.ok) {
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function disconnect() {
    if (!window.confirm("Remove this bank link from the app? (You can reconnect later.)")) return;
    setMsg(null);
    start(async () => {
      const r = await disconnectPlaidItemAction(item.id);
      if (r.ok) {
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.institutionName ?? "Linked account"}</p>
          <p className="text-xs text-zinc-500">
            Linked {new Date(item.createdAt).toLocaleString()}
            {item.lastSyncAt
              ? ` · last sync ${new Date(item.lastSyncAt).toLocaleString()}`
              : item.transactionsCursor
                ? " · sync cursor set"
                : " · never synced"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => sync()}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Sync transactions
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => disconnect()}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            Disconnect
          </button>
        </div>
      </div>

      {item.lastSyncError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {item.lastSyncError}
          {item.lastSyncError.includes("ITEM_LOGIN_REQUIRED") ||
          /re-link|login/i.test(item.lastSyncError)
            ? " — disconnect and connect again to fix."
            : ""}
        </p>
      ) : null}

      {item.accounts.length > 0 ? (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {item.accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-zinc-800 dark:text-zinc-200">
                  {a.name}
                  {a.mask ? <span className="text-zinc-400"> ··{a.mask}</span> : null}
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {a.subtype ?? a.type}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                  {a.currentBalanceCents != null ? formatCents(a.currentBalanceCents) : "—"}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-emerald-600"
                    checked={a.syncToExpenses}
                    disabled={pending}
                    onChange={(e) => toggleAccount(a.id, e.target.checked)}
                  />
                  to expenses
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {msg}
          {lastImported != null && lastImported > 0 ? (
            <>
              {" "}
              <Link
                href={`/expenses?ym=${yearMonth}`}
                className="font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                Open expenses for {yearMonth} →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
