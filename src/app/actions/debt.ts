"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";

export async function addDebtAccountAction(formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const bal = parseMoneyToCents(String(formData.get("balance") ?? ""));
  const minPay = parseMoneyToCents(String(formData.get("minimumPayment") ?? ""));
  const aprRaw = String(formData.get("apr") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!name || bal == null) return;
  const apr = aprRaw ? Number.parseFloat(aprRaw) : null;
  await prisma.debtAccount.create({
    data: {
      name,
      balanceCents: bal,
      minimumPaymentCents: minPay ?? undefined,
      aprPercent: apr != null && !Number.isNaN(apr) ? apr : undefined,
      note,
    },
  });
  revalidatePath("/debt");
}

export async function deleteDebtAccountAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.debtAccount.delete({ where: { id } });
  revalidatePath("/debt");
}
