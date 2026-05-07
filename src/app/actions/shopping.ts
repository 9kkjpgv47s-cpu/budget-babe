"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import type { FormActionState } from "@/lib/formActionState";

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
  revalidatePath("/shopping");
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
  const existing = await prisma.shoppingTrip.findUnique({ where: { id: tripId } });
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

  await prisma.$transaction(async (tx) => {
    await tx.shoppingTripItem.deleteMany({ where: { tripId } });
    await tx.shoppingTrip.update({
      where: { id: tripId },
      data: { storeName, shoppedAt, totalCents },
    });
    await tx.shoppingTripItem.createMany({
      data: items.map((it) => ({
        tripId,
        name: it.name,
        quantity: it.quantity,
        priceCents: it.priceCents ?? null,
      })),
    });
  });
  revalidatePath("/shopping");
  return { ok: true };
}

export async function updateFullTripAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return updateFullTripCore(formData);
}

export async function deleteTripAction(formData: FormData): Promise<void> {
  await requireUser();
  const tripId = String(formData.get("tripId") ?? "");
  if (!tripId) return;
  await prisma.shoppingTrip.delete({ where: { id: tripId } });
  revalidatePath("/shopping");
}
