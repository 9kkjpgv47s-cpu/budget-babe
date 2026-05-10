import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { addDebtAccountAction, deleteDebtAccountAction, updateDebtAccountAction } from "@/app/actions/debt";

export default async function DebtPage() {
  await requireUser();
  const accounts = await prisma.debtAccount.findMany({
    orderBy: { balanceCents: "desc" },
  });
  const total = accounts.reduce((s, a) => s + a.balanceCents, 0);
  const minTotal =
    accounts.reduce((s, a) => s + (a.minimumPaymentCents ?? 0), 0) || null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Debt (manual)</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track balances and minimums — edit in place or remove.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/" className="text-emerald-600 underline">
            ← Overview
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Totals</h2>
        <p className="mt-2 text-lg font-semibold tabular-nums">
          {formatCents(total)} owed
        </p>
        {minTotal ? (
          <p className="text-sm text-zinc-600">
            Minimum payments (sum): {formatCents(minTotal)}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Add account</h2>
        <form action={addDebtAccountAction} className="mt-4 grid gap-2 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Card or loan name"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="balance"
            placeholder="Current balance"
            inputMode="decimal"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="minimumPayment"
            placeholder="Min payment (optional)"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="apr"
            placeholder="APR % (optional)"
            inputMode="decimal"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <input
            name="note"
            placeholder="Note (optional)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:col-span-2"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Accounts</h2>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm"
            >
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatCents(a.balanceCents)}
                </div>
                {a.minimumPaymentCents != null ? (
                  <div className="text-xs text-zinc-500">
                    Min {formatCents(a.minimumPaymentCents)}
                    {a.aprPercent != null ? ` · ${a.aprPercent}% APR` : ""}
                  </div>
                ) : null}
                {a.note ? (
                  <div className="text-xs text-zinc-500">{a.note}</div>
                ) : null}
              </div>
              <form action={updateDebtAccountAction} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={a.id} />
                <input
                  name="name"
                  defaultValue={a.name}
                  className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  name="balance"
                  defaultValue={(a.balanceCents / 100).toFixed(2)}
                  inputMode="decimal"
                  className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  name="minimumPayment"
                  defaultValue={
                    a.minimumPaymentCents != null
                      ? (a.minimumPaymentCents / 100).toFixed(2)
                      : ""
                  }
                  placeholder="Min pay"
                  inputMode="decimal"
                  className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  name="apr"
                  defaultValue={a.aprPercent != null ? String(a.aprPercent) : ""}
                  placeholder="APR %"
                  inputMode="decimal"
                  className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
                />
                <input
                  name="note"
                  defaultValue={a.note ?? ""}
                  placeholder="Note"
                  className="sm:col-span-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  className="rounded bg-emerald-600 py-1 text-xs text-white sm:col-span-2"
                >
                  Save
                </button>
              </form>
              <form action={deleteDebtAccountAction} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 underline hover:no-underline"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No debt accounts yet.</p>
        ) : null}
      </section>
    </div>
  );
}
