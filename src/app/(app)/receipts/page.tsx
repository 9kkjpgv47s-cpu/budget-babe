import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { currentYearMonth } from "@/lib/yearMonth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { ReceiptUploadForm } from "./ReceiptUploadForm";
import { ReceiptListItem } from "./ReceiptOcrSection";
import { OcrStatusPoller } from "./OcrStatusPoller";

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

  const ocrPending = receipts.some(
    (r) => r.ocrStatus === "pending" || r.ocrStatus === "processing",
  );

  return (
    <div className="space-y-8">
      <OcrStatusPoller active={ocrPending} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload photos or PDFs. <strong>Images</strong> are run through{" "}
          <span className="font-medium">Tesseract</span> OCR on the server.{" "}
          <strong>PDFs</strong> use embedded text when available (scanned PDFs
          need a photo for OCR).
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
            <ReceiptListItem key={r.id} receipt={r} />
          ))}
        </ul>
        {receipts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No receipts for this month.</p>
        ) : null}
      </section>
    </div>
  );
}
