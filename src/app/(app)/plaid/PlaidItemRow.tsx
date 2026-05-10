"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectPlaidItemAction, syncPlaidItemAction } from "@/app/actions/plaid";

type Row = {
  id: string;
  institutionName: string | null;
  itemId: string;
  createdAt: string;
  transactionsCursor: string | null;
};

export function PlaidItemRow({ item }: { item: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function sync() {
    setMsg(null);
    start(async () => {
      const r = await syncPlaidItemAction(item.id);
      if (r.ok) {
        setMsg(`Imported ${r.imported} new (${r.skipped} skipped), ${r.pages} page(s).`);
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
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.institutionName ?? "Linked account"}</p>
        <p className="text-xs text-zinc-500">
          Linked {new Date(item.createdAt).toLocaleString()}
          {item.transactionsCursor ? " · sync cursor set" : " · never synced"}
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
      {msg ? <p className="basis-full text-sm text-zinc-700 dark:text-zinc-300">{msg}</p> : null}
    </li>
  );
}
