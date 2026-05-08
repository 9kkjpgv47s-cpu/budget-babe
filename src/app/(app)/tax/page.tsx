import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { localCalendarYearBounds, parseTaxYear } from "@/lib/taxYear";
import { taxCategoryLabel } from "@/lib/taxCategories";
import { isInTaxWorkpaperFolder, resolveGuidance } from "@/lib/taxCodeGuidance";
import { TaxBulkAssign } from "./TaxBulkAssign";
import { TaxCategoryTotals, TaxFolderTable } from "./TaxFolderRows";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; taxErr?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const nowY = new Date().getFullYear();
  const year = parseTaxYear(sp.year, nowY);
  const { start, end } = localCalendarYearBounds(year);
  const taxErrRaw = sp.taxErr?.trim();
  const taxErr = taxErrRaw ? decodeURIComponent(taxErrRaw.replace(/\+/g, " ")) : null;

  const expenses = await prisma.expense.findMany({
    where: { spentAt: { gte: start, lt: end } },
    orderBy: { spentAt: "desc" },
    include: {
      user: { select: { name: true } },
      monthlyPeriod: { select: { yearMonth: true } },
      taxReviewedBy: { select: { name: true } },
    },
  });

  const workpaper = expenses.filter((e) => isInTaxWorkpaperFolder(e.taxApplicability));
  const folderRows = workpaper.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    spentAt: e.spentAt,
    yearMonth: e.monthlyPeriod.yearMonth,
    payee: e.payee,
    source: e.source,
    userName: e.user?.name ?? null,
    receiptId: e.receiptId,
    taxApplicability: e.taxApplicability,
    taxCodeRefId: e.taxCodeRefId,
    taxCategory: e.taxCategory,
    taxNote: e.taxNote,
    taxReviewedAt: e.taxReviewedAt,
  }));

  const categoryMap = new Map<string, { count: number; cents: number }>();
  for (const e of workpaper) {
    const c = e.taxCategory ?? "other_qualifying";
    const cur = categoryMap.get(c) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += e.amountCents;
    categoryMap.set(c, cur);
  }
  const totals = [...categoryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.cents - a.cents);

  const workpaperCents = workpaper.reduce((s, e) => s + e.amountCents, 0);
  const reviewedCount = workpaper.filter((e) => e.taxReviewedAt).length;

  const audits = await prisma.taxExpenseAudit.findMany({
    where: { expense: { spentAt: { gte: start, lt: end } } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      user: { select: { name: true } },
      expense: { select: { description: true, amountCents: true } },
    },
  });

  const bulkRows = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    spentAt: e.spentAt.toISOString(),
    yearMonth: e.monthlyPeriod.yearMonth,
    taxApplicability: e.taxApplicability,
    taxCategory: e.taxCategory,
  }));

  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tax records</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Each expense can be <strong>not applicable</strong>, <strong>applicable</strong>, or{" "}
          <strong>applicable with proper documentation</strong> (for example when you have notes but no official receipt
          in this app). Pick the IRC-oriented <strong>guidance</strong> snippet and open <strong>View tax guidance</strong>{" "}
          for the full text. This is record-keeping only — not tax advice.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">Year:</span>
          <Link
            href={`/tax?year=${prevYear}`}
            className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {prevYear}
          </Link>
          <span className="rounded bg-emerald-100 px-3 py-1 font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
            {year}
          </span>
          <Link
            href={`/tax?year=${nextYear}`}
            className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {nextYear}
          </Link>
          <a
            href={`/api/export/tax?year=${year}`}
            className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Download workpaper CSV ({year})
          </a>
        </div>
      </div>

      {taxErr ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {taxErr}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Summary</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-zinc-500">Applicable lines</p>
            <p className="text-xl font-semibold tabular-nums">{workpaper.length}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-zinc-500">Reviewed</p>
            <p className="text-xl font-semibold tabular-nums">
              {reviewedCount}
              <span className="text-sm font-normal text-zinc-400"> / {workpaper.length || "—"}</span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-zinc-500">Total (applicable)</p>
            <p className="text-xl font-semibold tabular-nums">{formatCents(workpaperCents)}</p>
          </div>
        </div>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">By preparer folder</h3>
        <TaxCategoryTotals year={year} totals={totals} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tax workpaper folder ({year})</h2>
        <TaxFolderTable year={year} rows={folderRows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mark applicable (bulk)</h2>
        <TaxBulkAssign year={year} rows={bulkRows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent audit log</h2>
        <p className="text-xs text-zinc-500">
          Append-only trail when tax fields change (household accountability). Newest first.
        </p>
        {audits.length === 0 ? (
          <p className="text-sm text-zinc-500">No tax audits yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audits.map((a) => {
              let detail = "";
              try {
                const j = JSON.parse(a.detailsJson ?? "{}") as {
                  before?: TaxSnapshotLite;
                  after?: TaxSnapshotLite;
                };
                detail = summarizeDelta(j.before, j.after);
              } catch {
                detail = a.detailsJson ?? "";
              }
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">{a.action}</span>
                  <span className="text-zinc-500"> · </span>
                  <span>{a.createdAt.toLocaleString()}</span>
                  {a.user?.name ? (
                    <>
                      <span className="text-zinc-500"> · </span>
                      <span>{a.user.name}</span>
                    </>
                  ) : null}
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    {formatCents(a.expense.amountCents)} — {a.expense.description}
                  </p>
                  {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        <Link href="/expenses" className="underline">
          Expenses
        </Link>{" "}
        uses the same controls while you reconcile a month.
      </p>
    </div>
  );
}

type TaxSnapshotLite = {
  applicability?: string | null;
  codeRef?: string | null;
  category?: string | null;
  note?: string | null;
  reviewedAt?: string | null;
};

function guidanceTitle(id: string | null | undefined): string {
  return resolveGuidance(id ?? null)?.title ?? id ?? "—";
}

function summarizeDelta(b?: TaxSnapshotLite, a?: TaxSnapshotLite): string {
  if (!b || !a) return "";
  const parts: string[] = [];
  if (b.applicability !== a.applicability) parts.push(`status ${b.applicability ?? "—"} → ${a.applicability ?? "—"}`);
  if (b.codeRef !== a.codeRef) parts.push(`guidance ${guidanceTitle(b.codeRef)} → ${guidanceTitle(a.codeRef)}`);
  if (b.category !== a.category)
    parts.push(`folder ${taxCategoryLabel(b.category ?? null)} → ${taxCategoryLabel(a.category ?? null)}`);
  if ((b.note ?? "") !== (a.note ?? "")) parts.push("note updated");
  if (b.reviewedAt !== a.reviewedAt) parts.push("review status changed");
  // legacy audits
  if ("qualifying" in b || "qualifying" in a) {
    const bq = (b as { qualifying?: boolean }).qualifying;
    const aq = (a as { qualifying?: boolean }).qualifying;
    if (bq !== aq) parts.push(`legacy qualifying ${bq} → ${aq}`);
  }
  return parts.join("; ") || "updated";
}
