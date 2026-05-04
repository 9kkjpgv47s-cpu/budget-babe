import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { currentYearMonth } from "@/lib/yearMonth";
import { deleteReceiptAction } from "@/app/actions/receipts";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { ReceiptUploadForm } from "./ReceiptUploadForm";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();

  const period = await getOrCreateMonthlyPeriod(yearMonth);

  const receipts = await prisma.receipt.findMany({
    where: { monthlyPeriodId: period.id },
    orderBy: { uploadedAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Store images for expense tracking. Enter totals when you know them so
          they show up on the overview.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/" className="text-emerald-600 underline">
            ← Back to overview
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Upload for {yearMonth}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Change month from the overview using the arrows, then open this page
          again, or add{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            ?ym=YYYY-MM
          </code>{" "}
          to the URL.
        </p>
        <ReceiptUploadForm yearMonth={yearMonth} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">This month</h2>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
            >
              <div>
                <a
                  href={`/api/receipts/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-emerald-700 underline dark:text-emerald-400"
                >
                  {r.filename}
                </a>
                <div className="text-xs text-zinc-500">
                  {r.uploadedAt.toLocaleString()}
                  {r.user ? ` · ${r.user.name}` : ""}
                </div>
                {r.totalCents != null ? (
                  <div className="mt-1 font-medium tabular-nums">
                    {formatCents(r.totalCents)}
                  </div>
                ) : null}
                {r.note ? <div className="text-zinc-600">{r.note}</div> : null}
              </div>
              <form action={deleteReceiptAction}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 underline hover:no-underline"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
        {receipts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No receipts for this month.</p>
        ) : null}
      </section>
    </div>
  );
}
