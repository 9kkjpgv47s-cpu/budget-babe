"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import type { FormActionState } from "@/lib/formActionState";

export async function uploadReceiptCore(
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const yearMonth = String(formData.get("yearMonth") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const total = parseMoneyToCents(String(formData.get("total") ?? ""));
  const file = formData.get("file");
  if (!yearMonth || !(file instanceof File) || file.size === 0) {
    return { error: "Choose a file and month." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "File must be 8MB or smaller." };
  }
  const period = await getOrCreateMonthlyPeriod(yearMonth);
  const ext = path.extname(file.name) || ".bin";
  const safeBase = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 40);
  const filename = `${Date.now()}-${safeBase || "receipt"}${ext}`;
  const uploadDir = path.join(process.cwd(), "data", "receipts");
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);
  await prisma.receipt.create({
    data: {
      monthlyPeriodId: period.id,
      userId: user.userId,
      filename,
      note,
      totalCents: total,
    },
  });
  revalidatePath("/");
  revalidatePath("/receipts");
  return { ok: true };
}

export async function uploadReceiptAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return uploadReceiptCore(formData);
}

export async function deleteReceiptAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.receipt.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/receipts");
}
