"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function addMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const pattern = String(formData.get("pattern") ?? "").trim().toLowerCase();
  const tag = String(formData.get("tag") ?? "").trim().toLowerCase();
  if (!pattern || !tag) return;
  await prisma.merchantRule.create({
    data: { pattern, tag, sortOrder: 0 },
  });
  revalidatePath("/import");
}

export async function deleteMerchantRuleAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.merchantRule.delete({ where: { id } });
  revalidatePath("/import");
}
