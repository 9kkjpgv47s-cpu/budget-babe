import Link from "next/link";
import { addMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { requireUser } from "@/lib/auth";
import { currentYearMonth, parseYearMonth } from "@/lib/yearMonth";
import { ensureDefaultCategories } from "@/lib/categories";
import {
  batchResolveReceiptPostingContexts,
  suggestReceiptExpenseDescription,
} from "@/lib/entryDefaults";
import { ReceiptUploadForm } from "./ReceiptUploadForm";
import { ReceiptListItem } from "./ReceiptOcrSection";
import { OcrStatusPoller } from "./OcrStatusPoller";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  await requireUser();
  await ensureDefaultCategories();
  const sp = await searchParams;
  const yearMonth =
    sp.ym?.match(/^\d{4}-\d{2}$/) ? sp.ym : currentYearMonth();

  const monthOptions = Array.from({ length: 13 }, (_, i) =>
    format(addMonths(parseYearMonth(yearMonth), i - 6), "yyyy-MM"),
  );

  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const [categories, receipts] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.receipt.findMany({
      where: { monthlyPeriodId: period.id },
      orderBy: { uploadedAt: "desc" },
      include: {
        user: { select: { name: true } },
        monthlyPeriod: { select: { yearMonth: true } },
      },
    }),
  ]);
  const categoryIds = categories.map((c) => c.id);

  const contextByReceipt = await batchResolveReceiptPostingContexts(
    receipts,
    yearMonth,
    categoryIds,
  );

  const receiptRows = receipts.map((r) => {
    const ctx = contextByReceipt.get(r.id)!;
    return {
      receipt: r,
      postingYearMonth: ctx.postingYearMonth,
      postingBudgetPlans: ctx.postingBudgetPlans,
      defaultBudgetPlanId: ctx.defaultBudgetPlanId,
      defaultCategoryId: ctx.defaultCategoryId,
      defaultPayee: ctx.defaultPayee,
      suggestedDescription: suggestReceiptExpenseDescription({
        filename: r.filename,
        note: r.note,
        ocrParsedLines: r.ocrParsedLines,
      }),
    };
  });

  const ocrPending = receipts.some(
    (r) => r.ocrStatus === "pending" || r.ocrStatus === "processing",
  );

  return (
    <div className="space-y-8">
      <OcrStatusPoller active={ocrPending} yearMonth={yearMonth} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <strong className="text-zinc-800 dark:text-zinc-200">
            Use your camera or photo library
          </strong>{" "}
          for receipts — that is the path we optimize for (sharp picture, good
          light). PDFs still work; scanned PDFs take longer and only the first
          pages are OCR’d.
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
          {receiptRows.map((row) => (
            <ReceiptListItem
              key={row.receipt.id}
              receipt={row.receipt}
              yearMonth={yearMonth}
              categories={categories}
              budgetPlans={row.postingBudgetPlans}
              monthOptions={monthOptions}
              defaultBudgetPlanId={row.defaultBudgetPlanId}
              defaultCategoryId={row.defaultCategoryId}
              defaultPayee={row.defaultPayee}
              postingYearMonth={row.postingYearMonth}
              suggestedDescription={row.suggestedDescription}
            />
          ))}
        </ul>
        {receipts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No receipts for this month.</p>
        ) : null}
      </section>
    </div>
  );
}
