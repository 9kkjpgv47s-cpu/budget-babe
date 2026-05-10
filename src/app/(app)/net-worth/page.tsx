import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import {
  addNetWorthAccountAction,
  deleteNetWorthAccountAction,
  recordNetWorthSnapshotAction,
  updateNetWorthAccountAction,
} from "@/app/actions/networth";

export default async function NetWorthPage() {
  await requireUser();
  const [accounts, snapshots] = await Promise.all([
    prisma.netWorthAccount.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.netWorthSnapshot.findMany({
      orderBy: { recordedAt: "desc" },
      take: 24,
    }),
  ]);
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (a.kind === "asset") assets += a.balanceCents;
    else liab += a.balanceCents;
  }
  const net = assets - liab;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Net worth</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manual accounts (no bank sync). Record snapshots to track history.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/" className="text-emerald-600 underline">
            ← Overview
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Current totals</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Assets</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatCents(assets)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Liabilities</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatCents(liab)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Net</dt>
            <dd className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCents(net)}
            </dd>
          </div>
        </dl>
        <form action={recordNetWorthSnapshotAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input
            name="note"
            placeholder="Snapshot note (optional)"
            className="min-w-[12rem] flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Record snapshot
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Add account</h2>
        <form action={addNetWorthAccountAction} className="mt-4 grid gap-2 sm:grid-cols-2">
          <select
            name="kind"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
          <input
            name="name"
            placeholder="Name"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="balance"
            placeholder="Balance"
            inputMode="decimal"
            required
            className="sm:col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-zinc-900 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Accounts</h2>
        <ul className="mt-4 space-y-6">
          {accounts.map((a) => (
            <li key={a.id} className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
              <form action={updateNetWorthAccountAction} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={a.id} />
                <select
                  name="kind"
                  defaultValue={a.kind}
                  className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
                <input
                  name="name"
                  defaultValue={a.name}
                  className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  name="balance"
                  defaultValue={(a.balanceCents / 100).toFixed(2)}
                  inputMode="decimal"
                  className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  className="rounded bg-emerald-600 py-1 text-xs text-white sm:col-span-2"
                >
                  Save
                </button>
              </form>
              <form action={deleteNetWorthAccountAction} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-xs text-red-600 underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500">No accounts yet.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Snapshots</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {snapshots.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 border-b border-zinc-50 py-2 dark:border-zinc-800">
              <span className="text-zinc-500">{s.recordedAt.toLocaleString()}</span>
              <span className="tabular-nums font-medium">{formatCents(s.netCents)}</span>
            </li>
          ))}
        </ul>
        {snapshots.length === 0 ? (
          <p className="text-sm text-zinc-500">No snapshots yet.</p>
        ) : null}
      </section>
    </div>
  );
}
