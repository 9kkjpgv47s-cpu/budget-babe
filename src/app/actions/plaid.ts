"use server";

import { revalidatePath } from "next/cache";
import { getPlaidApi } from "@/lib/plaidClient";
import { prisma } from "@/lib/prisma";
import { syncPlaidItemTransactions } from "@/lib/plaidSync";
import { getSession } from "@/lib/auth";

function revalidatePlaidRelated() {
  revalidatePath("/plaid");
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/flow");
  revalidatePath("/insights");
}

export async function syncPlaidItemAction(
  plaidRowId: string,
): Promise<{ ok: true; imported: number; skipped: number; pages: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, error: "Unauthorized" };
  }
  const item = await prisma.plaidItem.findFirst({
    where: { id: plaidRowId, userId: session.user.userId },
  });
  if (!item) {
    return { ok: false, error: "Account link not found." };
  }
  try {
    const r = await syncPlaidItemTransactions(plaidRowId, session.user.userId);
    revalidatePlaidRelated();
    return { ok: true, ...r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return { ok: false, error: msg };
  }
}

export async function disconnectPlaidItemAction(
  plaidRowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, error: "Unauthorized" };
  }
  const item = await prisma.plaidItem.findFirst({
    where: { id: plaidRowId, userId: session.user.userId },
  });
  if (!item) {
    return { ok: false, error: "Account link not found." };
  }
  const client = getPlaidApi();
  if (client) {
    try {
      await client.itemRemove({ access_token: item.accessToken });
    } catch {
      // Still drop local row if Plaid revoke fails (e.g. expired item).
    }
  }
  await prisma.plaidItem.delete({ where: { id: item.id } });
  revalidatePlaidRelated();
  return { ok: true };
}
