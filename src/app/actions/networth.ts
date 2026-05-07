"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";

export async function addNetWorthAccountAction(formData: FormData): Promise<void> {
  await requireUser();
  const kind = String(formData.get("kind") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const bal = parseMoneyToCents(String(formData.get("balance") ?? ""));
  if (!name || bal == null || (kind !== "asset" && kind !== "liability")) return;
  const maxSort = await prisma.netWorthAccount.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
  await prisma.netWorthAccount.create({
    data: { kind, name, balanceCents: bal, sortOrder },
  });
  revalidatePath("/net-worth");
}

export async function updateNetWorthAccountAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const bal = parseMoneyToCents(String(formData.get("balance") ?? ""));
  const kind = String(formData.get("kind") ?? "").trim();
  if (!id || !name || bal == null) return;
  if (kind !== "asset" && kind !== "liability") return;
  await prisma.netWorthAccount.update({
    where: { id },
    data: { name, balanceCents: bal, kind },
  });
  revalidatePath("/net-worth");
}

export async function deleteNetWorthAccountAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.netWorthAccount.delete({ where: { id } });
  revalidatePath("/net-worth");
}

export async function recordNetWorthSnapshotAction(formData: FormData): Promise<void> {
  await requireUser();
  const note = String(formData.get("note") ?? "").trim() || null;
  const accounts = await prisma.netWorthAccount.findMany();
  let assets = 0;
  let liab = 0;
  for (const a of accounts) {
    if (a.kind === "asset") assets += a.balanceCents;
    else liab += a.balanceCents;
  }
  await prisma.netWorthSnapshot.create({
    data: {
      assetsCents: assets,
      liabilitiesCents: liab,
      netCents: assets - liab,
      note,
    },
  });
  revalidatePath("/net-worth");
}
