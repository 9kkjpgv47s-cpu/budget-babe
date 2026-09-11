"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncAllPlaidItemsAction } from "@/app/actions/plaid";

export function PlaidSyncAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function syncAll() {
    setMsg(null);
    start(async () => {
      const r = await syncAllPlaidItemsAction();
      if (r.ok) {
        const total = r.results.reduce((s, x) => s + x.imported, 0);
        setMsg(`Synced ${r.results.length} link(s) — ${total} new transaction(s).`);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => syncAll()}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        {pending ? "Syncing…" : "Sync all"}
      </button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
