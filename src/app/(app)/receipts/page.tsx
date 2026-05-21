import Link from "next/link";
import { addMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { requireUser } from "@/lib/auth";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import { ReceiptUploadForm } from "./ReceiptUploadForm";
import { ReceiptListItem } from "./ReceiptOcrSection";
import { OcrStatusPoller } from "./OcrStatusPoller";
import { ReceiptBlobWarning } from "./ReceiptBlobWarning";
import { ReceiptMonthHeader } from "./ReceiptMonthHeader";
import { ReceiptFocusScroll } from "./ReceiptFocusScroll";
import { ReceiptNeedsPostingQueue } from "./ReceiptNeedsPostingQueue";
import { ReceiptFilterTabs } from "./ReceiptFilterTabs";
import { ReceiptSearchForm } from "./ReceiptSearchForm";
import {
  countByFilter,
  filterReceipts,
  parseReceiptFilter,
  type ReceiptListRow,
} from "./receiptFilters";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; focus?: string; filter?: string; q?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();
  const focusId = sp.focus?.trim() || null;
  const filter = parseReceiptFilter(sp.filter);
  const query = (sp.q ?? "").trim();

  const period = await getOrCreateMonthlyPeriod(yearMonth);

  const monthOptions = Array.from({ length: 13 }, (_, i) =>
    format(addMonths(parseYearMonth(yearMonth), i - 6), "yyyy-MM"),
  );

  const [receipts, budgetPlans] = await Promise.all([
    prisma.receipt.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { uploadedAt: "desc" },
      include: {
        user: { select: { name: true } },
        _count: { select: { expenses: true } },
      },
    }),
    prisma.budgetPlan.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);

  const rows: ReceiptListRow[] = receipts.map((r) => ({
    id: r.id,
    filename: r.filename,
    note: r.note,
    ocrStatus: r.ocrStatus,
    totalCents: r.totalCents,
    expenseCount: r._count.expenses,
  }));
  const counts = countByFilter(rows);
  const visible = filterReceipts(rows, filter, query);
  const visibleIds = new Set(visible.map((v) => v.id));

  const ocrPending = receipts.some(
    (r) => r.ocrStatus === "pending" || r.ocrStatus === "processing",
  );
  const needsPosting = receipts.filter(
    (r) =>
      r._count.expenses === 0 &&
      r.ocrStatus === "completed" &&
      r.totalCents != null &&
      r.totalCents > 0,
  );

  return (
    <div className="space-y-8">
      <ReceiptBlobWarning />
      <ReceiptFocusScroll focusId={focusId} />
      <OcrStatusPoller active={ocrPending} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <div className="mt-3">
          <ReceiptMonthHeader yearMonth={yearMonth} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          <strong className="text-zinc-800 dark:text-zinc-200">
            Use your camera or photo library
          </strong>{" "}
          for receipts — that is the path we optimize for (sharp picture, good
          light). PDFs still work; scanned PDFs take longer and only the first
          pages are OCR’d.
        </p>
        <p className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-emerald-600 underline">
            ← Back to overview
          </Link>
          <Link href={`/expenses?ym=${yearMonth}`} className="text-emerald-600 underline">
            View spending for {yearMonth}
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Upload for {yearMonth}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Month: <strong>{yearMonth}</strong>. Change from overview arrows or{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">?ym=YYYY-MM</code>.
          After OCR, amounts and dates flow into Expenses automatically when you post.
        </p>
        <ReceiptUploadForm
          yearMonth={yearMonth}
          formIdSuffix="-page"
          redirectAfterUpload
        />
      </section>

      {filter === "all" && !query ? (
        <ReceiptNeedsPostingQueue receipts={needsPosting} yearMonth={yearMonth} />
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">All receipts this month</h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {visible.length} shown
            {visible.length !== receipts.length
              ? ` · ${receipts.length} total`
              : null}
          </span>
        </div>
        <div className="mt-4 space-y-4">
          <ReceiptFilterTabs
            yearMonth={yearMonth}
            active={filter}
            counts={counts}
            query={query}
          />
          <ReceiptSearchForm yearMonth={yearMonth} filter={filter} query={query} />
        </div>
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {receipts
            .filter((r) => visibleIds.has(r.id))
            .map((r) => (
              <ReceiptListItem
                key={r.id}
                receipt={{
                  ...r,
                  expenseCount: r._count.expenses,
                }}
                yearMonth={yearMonth}
                budgetPlans={budgetPlans}
                monthOptions={monthOptions}
              />
            ))}
        </ul>
        {receipts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No receipts for this month.</p>
        ) : visible.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No receipts match this filter
            {query ? ` or “${query}”` : ""}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
