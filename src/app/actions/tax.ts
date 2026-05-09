"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isValidTaxCategory } from "@/lib/taxCategories";
import {
  defaultGuidanceId,
  isInTaxWorkpaperFolder,
  isValidGuidanceRefForApplicability,
  isValidTaxApplicability,
  type TaxApplicabilityId,
} from "@/lib/taxCodeGuidance";
import { localCalendarYearBounds } from "@/lib/taxYear";

function revalidateTax(year: string) {
  revalidatePath("/tax");
  revalidatePath(`/tax?year=${year}`);
  revalidatePath("/expenses");
  revalidatePath("/");
}

type TaxSnapshot = {
  applicability: string | null;
  codeRef: string | null;
  category: string | null;
  note: string | null;
  reviewedAt: string | null;
};

function snap(e: {
  taxApplicability: string | null;
  taxCodeRefId: string | null;
  taxCategory: string | null;
  taxNote: string | null;
  taxReviewedAt: Date | null;
}): TaxSnapshot {
  return {
    applicability: e.taxApplicability,
    codeRef: e.taxCodeRefId,
    category: e.taxCategory,
    note: e.taxNote,
    reviewedAt: e.taxReviewedAt?.toISOString() ?? null,
  };
}

function redirectTaxValidationError(
  message: string,
  opts: { taxYear: string; from: string; yearMonth?: string },
) {
  const q = encodeURIComponent(message);
  if (opts.from === "expenses" && opts.yearMonth) {
    redirect(`/expenses?ym=${encodeURIComponent(opts.yearMonth)}&taxErr=${q}`);
  }
  redirect(`/tax?year=${encodeURIComponent(opts.taxYear)}&taxErr=${q}`);
}

async function writeTaxAuditSafe(params: {
  expenseId: string;
  userId: string;
  action: "classify" | "review" | "clear";
  before: TaxSnapshot;
  after: TaxSnapshot;
}) {
  try {
    await prisma.taxExpenseAudit.create({
      data: {
        expenseId: params.expenseId,
        userId: params.userId,
        action: params.action,
        detailsJson: JSON.stringify({
          before: params.before,
          after: params.after,
        }),
      },
    });
  } catch (error) {
    /**
     * Audit logging is best-effort in Neon HTTP mode where multi-step writes
     * are not transactional. Keep the primary user action successful.
     */
    console.error("[tax-audit] failed to write audit row", error);
  }
}

export async function saveExpenseTaxAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const redirectYear = String(formData.get("taxYear") ?? "").trim() || new Date().getFullYear().toString();
  const from = String(formData.get("from") ?? "tax").trim();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();

  const appRaw = String(formData.get("taxApplicability") ?? "").trim();
  const refRaw = String(formData.get("taxCodeRefId") ?? "").trim();
  const categoryRaw = String(formData.get("taxCategory") ?? "").trim();
  const note = String(formData.get("taxNote") ?? "").trim() || null;

  if (!expenseId) return;

  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!exp) return;

  if (!isValidTaxApplicability(appRaw)) {
    redirectTaxValidationError("Choose a valid tax applicability.", { taxYear: redirectYear, from, yearMonth });
  }
  const taxApplicability = appRaw as TaxApplicabilityId;

  let taxCodeRefId = refRaw;
  if (!taxCodeRefId || !isValidGuidanceRefForApplicability(taxCodeRefId, taxApplicability)) {
    taxCodeRefId = defaultGuidanceId(taxApplicability);
  }

  if (taxApplicability === "applicable_with_documentation" && !exp.receiptId) {
    const n = note?.trim().length ?? 0;
    if (n < 4) {
      redirectTaxValidationError(
        "“Applicable with proper documentation” requires a short audit note when no receipt is linked (describe bank evidence, calendar, mileage, etc.).",
        { taxYear: redirectYear, from, yearMonth: yearMonth || exp.monthlyPeriod.yearMonth },
      );
    }
  }

  const before = snap(exp);

  let taxCategory: string | null = null;
  if (taxApplicability !== "not_applicable") {
    taxCategory = isValidTaxCategory(categoryRaw) ? categoryRaw : "record_only";
  }

  const taxNote = taxApplicability === "not_applicable" ? null : note;

  let taxReviewedAt = exp.taxReviewedAt;
  let taxReviewedByUserId = exp.taxReviewedByUserId;
  if (taxApplicability === "not_applicable") {
    taxReviewedAt = null;
    taxReviewedByUserId = null;
  }

  const after = snap({
    taxApplicability,
    taxCodeRefId,
    taxCategory,
    taxNote,
    taxReviewedAt,
  });

  const same =
    before.applicability === after.applicability &&
    before.codeRef === after.codeRef &&
    before.category === after.category &&
    before.note === after.note &&
    before.reviewedAt === after.reviewedAt;
  if (same) return;

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      taxApplicability,
      taxCodeRefId,
      taxCategory,
      taxNote,
      taxReviewedAt,
      taxReviewedByUserId,
    },
  });
  await writeTaxAuditSafe({
    expenseId,
    userId: user.userId,
    action: "classify",
    before,
    after,
  });

  revalidateTax(redirectYear);
  revalidatePath(`/expenses?ym=${exp.monthlyPeriod.yearMonth}`);
  revalidatePath("/expenses");
}

export async function markExpenseTaxReviewedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const redirectYear = String(formData.get("taxYear") ?? "").trim() || new Date().getFullYear().toString();
  if (!expenseId) return;

  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!exp || !isInTaxWorkpaperFolder(exp.taxApplicability)) return;

  const before = snap(exp);
  const now = new Date();
  const after = snap({
    taxApplicability: exp.taxApplicability,
    taxCodeRefId: exp.taxCodeRefId,
    taxCategory: exp.taxCategory,
    taxNote: exp.taxNote,
    taxReviewedAt: now,
  });

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      taxReviewedAt: now,
      taxReviewedByUserId: user.userId,
    },
  });
  await writeTaxAuditSafe({
    expenseId,
    userId: user.userId,
    action: "review",
    before,
    after,
  });

  revalidateTax(redirectYear);
  revalidatePath(`/expenses?ym=${exp.monthlyPeriod.yearMonth}`);
  revalidatePath("/expenses");
}

export async function clearExpenseTaxAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const redirectYear = String(formData.get("taxYear") ?? "").trim() || new Date().getFullYear().toString();
  if (!expenseId) return;

  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!exp) return;

  const before = snap(exp);
  const after = snap({
    taxApplicability: null,
    taxCodeRefId: null,
    taxCategory: null,
    taxNote: null,
    taxReviewedAt: null,
  });

  if (
    before.applicability === after.applicability &&
    before.codeRef === after.codeRef &&
    before.category === after.category &&
    before.note === after.note &&
    before.reviewedAt === after.reviewedAt
  ) {
    return;
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      taxApplicability: null,
      taxCodeRefId: null,
      taxCategory: null,
      taxNote: null,
      taxReviewedAt: null,
      taxReviewedByUserId: null,
    },
  });
  await writeTaxAuditSafe({
    expenseId,
    userId: user.userId,
    action: "clear",
    before,
    after,
  });

  revalidateTax(redirectYear);
  revalidatePath(`/expenses?ym=${exp.monthlyPeriod.yearMonth}`);
  revalidatePath("/expenses");
}

export async function bulkQualifyTaxExpensesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const year = String(formData.get("taxYear") ?? "").trim() || new Date().getFullYear().toString();
  const categoryRaw = String(formData.get("taxCategory") ?? "").trim();
  const idsRaw = String(formData.get("expenseIds") ?? "");
  const ids = idsRaw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0 || !isValidTaxCategory(categoryRaw)) return;

  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return;
  const { start, end } = localCalendarYearBounds(y);

  const taxApplicability: TaxApplicabilityId = "applicable";
  const taxCodeRefId = defaultGuidanceId(taxApplicability);

  for (const expenseId of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id: expenseId, spentAt: { gte: start, lt: end } },
    });
    if (!exp) continue;
    const before = snap(exp);
    const after = snap({
      taxApplicability,
      taxCodeRefId,
      taxCategory: categoryRaw,
      taxNote: exp.taxNote,
      taxReviewedAt: exp.taxReviewedAt,
    });
    if (
      before.applicability === after.applicability &&
      before.codeRef === after.codeRef &&
      before.category === after.category &&
      before.note === after.note &&
      before.reviewedAt === after.reviewedAt
    ) {
      continue;
    }
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        taxApplicability,
        taxCodeRefId,
        taxCategory: categoryRaw,
      },
    });
    await writeTaxAuditSafe({
      expenseId,
      userId: user.userId,
      action: "classify",
      before,
      after,
    });
  }

  revalidateTax(year);
  revalidatePath("/expenses");
}
