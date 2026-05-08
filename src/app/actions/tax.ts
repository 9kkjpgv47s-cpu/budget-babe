"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isValidTaxCategory } from "@/lib/taxCategories";
import { localCalendarYearBounds } from "@/lib/taxYear";

function revalidateTax(year: string) {
  revalidatePath("/tax");
  revalidatePath(`/tax?year=${year}`);
  revalidatePath("/expenses");
  revalidatePath("/");
}

type TaxSnapshot = {
  qualifying: boolean;
  category: string | null;
  note: string | null;
  reviewedAt: string | null;
};

function snap(e: {
  taxQualifying: boolean;
  taxCategory: string | null;
  taxNote: string | null;
  taxReviewedAt: Date | null;
}): TaxSnapshot {
  return {
    qualifying: e.taxQualifying,
    category: e.taxCategory,
    note: e.taxNote,
    reviewedAt: e.taxReviewedAt?.toISOString() ?? null,
  };
}

export async function saveExpenseTaxAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const redirectYear = String(formData.get("taxYear") ?? "").trim() || new Date().getFullYear().toString();
  const qualifying = formData.get("taxQualifying") === "on" || formData.get("taxQualifying") === "true";
  const categoryRaw = String(formData.get("taxCategory") ?? "").trim();
  const note = String(formData.get("taxNote") ?? "").trim() || null;

  if (!expenseId) return;

  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { monthlyPeriod: { select: { yearMonth: true } } },
  });
  if (!exp) return;

  const before = snap(exp);

  let taxCategory: string | null = null;
  if (qualifying) {
    taxCategory = isValidTaxCategory(categoryRaw) ? categoryRaw : "record_only";
  }

  const taxNote = qualifying ? note : null;
  const taxQualifying = qualifying;
  let taxReviewedAt = exp.taxReviewedAt;
  let taxReviewedByUserId = exp.taxReviewedByUserId;
  if (!taxQualifying) {
    taxReviewedAt = null;
    taxReviewedByUserId = null;
  }

  const after = snap({
    taxQualifying,
    taxCategory,
    taxNote,
    taxReviewedAt,
  });

  const same =
    before.qualifying === after.qualifying &&
    before.category === after.category &&
    before.note === after.note &&
    before.reviewedAt === after.reviewedAt;
  if (same) return;

  await prisma.$transaction([
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        taxQualifying,
        taxCategory,
        taxNote,
        taxReviewedAt,
        taxReviewedByUserId,
      },
    }),
    prisma.taxExpenseAudit.create({
      data: {
        expenseId,
        userId: user.userId,
        action: "classify",
        detailsJson: JSON.stringify({ before, after }),
      },
    }),
  ]);

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
  if (!exp || !exp.taxQualifying) return;

  const before = snap(exp);
  const now = new Date();
  const after = snap({
    taxQualifying: exp.taxQualifying,
    taxCategory: exp.taxCategory,
    taxNote: exp.taxNote,
    taxReviewedAt: now,
  });

  await prisma.$transaction([
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        taxReviewedAt: now,
        taxReviewedByUserId: user.userId,
      },
    }),
    prisma.taxExpenseAudit.create({
      data: {
        expenseId,
        userId: user.userId,
        action: "review",
        detailsJson: JSON.stringify({ before, after }),
      },
    }),
  ]);

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
    taxQualifying: false,
    taxCategory: null,
    taxNote: null,
    taxReviewedAt: null,
  });

  if (
    before.qualifying === after.qualifying &&
    before.category === after.category &&
    before.note === after.note &&
    before.reviewedAt === after.reviewedAt
  ) {
    return;
  }

  await prisma.$transaction([
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        taxQualifying: false,
        taxCategory: null,
        taxNote: null,
        taxReviewedAt: null,
        taxReviewedByUserId: null,
      },
    }),
    prisma.taxExpenseAudit.create({
      data: {
        expenseId,
        userId: user.userId,
        action: "clear",
        detailsJson: JSON.stringify({ before, after }),
      },
    }),
  ]);

  revalidateTax(redirectYear);
  revalidatePath(`/expenses?ym=${exp.monthlyPeriod.yearMonth}`);
  revalidatePath("/expenses");
}

/** Bulk: mark selected expenses as qualifying with a shared folder (from Tax page). */
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

  for (const expenseId of ids) {
    const exp = await prisma.expense.findFirst({
      where: { id: expenseId, spentAt: { gte: start, lt: end } },
    });
    if (!exp) continue;
    const before = snap(exp);
    const after = snap({
      taxQualifying: true,
      taxCategory: categoryRaw,
      taxNote: exp.taxNote,
      taxReviewedAt: exp.taxReviewedAt,
    });
    if (
      before.qualifying === after.qualifying &&
      before.category === after.category &&
      before.note === after.note &&
      before.reviewedAt === after.reviewedAt
    ) {
      continue;
    }
    await prisma.$transaction([
      prisma.expense.update({
        where: { id: expenseId },
        data: {
          taxQualifying: true,
          taxCategory: categoryRaw,
        },
      }),
      prisma.taxExpenseAudit.create({
        data: {
          expenseId,
          userId: user.userId,
          action: "classify",
          detailsJson: JSON.stringify({ before, after }),
        },
      }),
    ]);
  }

  revalidateTax(year);
  revalidatePath("/expenses");
}
