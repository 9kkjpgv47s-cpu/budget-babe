"use server";

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { revalidateLedgerPaths } from "@/lib/revalidateLedger";
import { currentYearMonth } from "@/lib/yearMonth";
import { requireUser } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { mergeTagLists } from "@/lib/budgetRollup";
import { finalizeClassifiedExpenseWrite } from "@/lib/expenseWrite";
import { parseMoneyToCents, formatCents } from "@/lib/money";
import { shoppingTripImportHash } from "@/lib/shoppingExpense";
import type { FormActionState } from "@/lib/formActionState";

function revalidateShoppingExpenseTargets(yearMonth: string) {
  revalidateLedgerPaths(yearMonth, [
    "shopping",
    "overview",
    "expenses",
    "budgets",
    "insights",
    "flow",
    "tax",
  ]);
}

function revalidateShoppingOnly() {
  revalidateLedgerPaths(currentYearMonth(), ["shopping"]);
}

export async function createFullTripCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const storeName = String(formData.get("storeName") ?? "").trim() || null;
  const shoppedAtRaw = String(formData.get("shoppedAt") ?? "").trim();
  const shoppedAt = shoppedAtRaw ? new Date(shoppedAtRaw) : new Date();
  if (Number.isNaN(shoppedAt.getTime())) {
    return { error: "Invalid date." };
  }
  const names = formData.getAll("itemName").map((v) => String(v).trim());
  const qtys = formData.getAll("itemQty").map((v) => Number.parseInt(String(v), 10));
  const prices = formData.getAll("itemPrice").map((v) => String(v).trim());

  const items: { name: string; quantity: number; priceCents: number | null }[] =
    [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name) continue;
    const quantity = Math.max(1, Number.isFinite(qtys[i]) ? qtys[i] : 1);
    const pc = prices[i] ? parseMoneyToCents(prices[i]) : null;
    items.push({ name, quantity, priceCents: pc });
  }
  if (items.length === 0) {
    return { error: "Add at least one line item." };
  }

  const totalCents = items.reduce((s, it) => {
    if (it.priceCents == null) return s;
    return s + it.priceCents * it.quantity;
  }, 0);

  await prisma.shoppingTrip.create({
    data: {
      storeName,
      shoppedAt,
      totalCents,
      items: {
        create: items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          priceCents: it.priceCents ?? undefined,
        })),
      },
    },
  });
  revalidateShoppingOnly();
  return { ok: true };
}

export async function createFullTripAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return createFullTripCore(formData);
}

export async function updateFullTripCore(
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();
  const tripId = String(formData.get("tripId") ?? "");
  if (!tripId) return { error: "Missing trip." };
  const existing = await prisma.shoppingTrip.findUnique({
    where: { id: tripId },
    include: { items: true },
  });
  if (!existing) return { error: "Trip not found." };
  const storeName = String(formData.get("storeName") ?? "").trim() || null;
  const shoppedAtRaw = String(formData.get("shoppedAt") ?? "").trim();
  const shoppedAt = shoppedAtRaw ? new Date(shoppedAtRaw) : existing.shoppedAt;
  if (Number.isNaN(shoppedAt.getTime())) {
    return { error: "Invalid date." };
  }
  const names = formData.getAll("itemName").map((v) => String(v).trim());
  const qtys = formData.getAll("itemQty").map((v) => Number.parseInt(String(v), 10));
  const prices = formData.getAll("itemPrice").map((v) => String(v).trim());

  const items: { name: string; quantity: number; priceCents: number | null }[] =
    [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name) continue;
    const quantity = Math.max(1, Number.isFinite(qtys[i]) ? qtys[i] : 1);
    const pc = prices[i] ? parseMoneyToCents(prices[i]) : null;
    items.push({ name, quantity, priceCents: pc });
  }
  if (items.length === 0) {
    return { error: "Add at least one line item." };
  }
  const totalCents = items.reduce((s, it) => {
    if (it.priceCents == null) return s;
    return s + it.priceCents * it.quantity;
  }, 0);

  await prisma.shoppingTrip.update({
    where: { id: tripId },
    data: { storeName, shoppedAt, totalCents },
  });
  await prisma.shoppingTripItem.deleteMany({ where: { tripId } });
  try {
    await prisma.shoppingTripItem.createMany({
      data: items.map((it) => ({
        tripId,
        name: it.name,
        quantity: it.quantity,
        priceCents: it.priceCents ?? null,
      })),
    });
  } catch (error) {
    /**
     * Neon HTTP adapter does not support transactions. If item rewrite fails,
     * best-effort restore previous rows so the trip remains usable.
     */
    try {
      if (existing.items.length > 0) {
        await prisma.shoppingTripItem.createMany({
          data: existing.items.map((it) => ({
            tripId,
            name: it.name,
            quantity: it.quantity,
            priceCents: it.priceCents,
          })),
        });
      }
    } catch (restoreError) {
      console.error("[shopping] failed to restore trip items after update", restoreError);
    }
    throw error;
  }
  revalidateShoppingOnly();
  return { ok: true };
}

export async function updateFullTripAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return updateFullTripCore(formData);
}

export async function duplicateTripAction(formData: FormData): Promise<void> {
  await requireUser();
  const tripId = String(formData.get("tripId") ?? "");
  if (!tripId) return;
  const src = await prisma.shoppingTrip.findUnique({
    where: { id: tripId },
    include: { items: true },
  });
  if (!src) return;
  const totalCents = src.items.reduce((s, it) => {
    if (it.priceCents == null) return s;
    return s + it.priceCents * it.quantity;
  }, 0);
  const baseName = src.storeName?.trim() || "Grocery trip";
  await prisma.shoppingTrip.create({
    data: {
      storeName: `${baseName} (copy)`,
      shoppedAt: new Date(),
      totalCents,
      items: {
        create: src.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          priceCents: it.priceCents ?? undefined,
        })),
      },
    },
  });
  revalidateShoppingOnly();
}

export async function deleteTripAction(formData: FormData): Promise<void> {
  await requireUser();
  const tripId = String(formData.get("tripId") ?? "");
  if (!tripId) return;
  await prisma.shoppingTrip.delete({ where: { id: tripId } });
  revalidateShoppingOnly();
}

export async function createExpenseFromShoppingTripAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const tripId = String(formData.get("tripId") ?? "").trim();
  let yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const budgetPlanIdRaw = String(formData.get("budgetPlanId") ?? "").trim();

  if (!tripId) return { error: "Missing trip." };

  const trip = await prisma.shoppingTrip.findUnique({
    where: { id: tripId },
    include: { items: true },
  });
  if (!trip) return { error: "Trip not found." };

  if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
    yearMonth = format(trip.shoppedAt, "yyyy-MM");
  }

  let amountCents = trip.totalCents;
  if (amountCents <= 0) {
    amountCents = trip.items.reduce((s, it) => {
      if (it.priceCents == null) return s;
      return s + it.priceCents * it.quantity;
    }, 0);
  }
  if (amountCents <= 0) {
    return {
      error:
        "Add prices to line items (or save a non-zero trip total) before logging as spending.",
    };
  }

  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const importHash = shoppingTripImportHash(tripId);
  const dup = await prisma.expense.findFirst({
    where: { monthlyPeriodId: period.id, importHash },
    select: { id: true, description: true },
  });
  if (dup) {
    return {
      error: `Already logged for ${yearMonth} (“${dup.description}”).`,
    };
  }

  let budgetPlanId: string | null = budgetPlanIdRaw || null;
  if (budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: budgetPlanId, monthlyPeriodId: period.id },
    });
    if (!plan) budgetPlanId = null;
  }

  const store = trip.storeName?.trim() || "Grocery trip";
  const description = `Shopping: ${store}`;
  const groceries = await prisma.category.findFirst({
    where: { slug: "groceries" },
    select: { id: true },
  });
  const write = await finalizeClassifiedExpenseWrite(
    {
      description,
      tagsJson: mergeTagLists(["grocery"]),
      budgetPlanId,
      payee: store,
    },
    period.id,
    yearMonth,
    { categoryId: groceries?.id ?? null },
  );

  await prisma.expense.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      amountCents,
      description,
      spentAt: trip.shoppedAt,
      source: "shopping",
      importHash,
      payee: write.payee,
      categoryId: write.categoryId,
      budgetPlanId: write.budgetPlanId,
      taxCategory: write.taxCategory,
      tagsJson: write.tagsJson,
    },
  });

  revalidateShoppingExpenseTargets(yearMonth);
  return {
    ok: true,
    message: `Logged ${formatCents(amountCents)} to ${yearMonth} spending.`,
  };
}
