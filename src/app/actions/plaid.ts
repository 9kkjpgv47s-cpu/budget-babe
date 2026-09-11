"use server";

import { revalidatePath } from "next/cache";
import { getPlaidApi } from "@/lib/plaidClient";
import { decryptAccessToken } from "@/lib/plaidToken";
import { prisma } from "@/lib/prisma";
import { syncPlaidItemTransactions, type PlaidSyncResult } from "@/lib/plaidSync";
import { getSession } from "@/lib/auth";

function revalidatePlaidRelated() {
  revalidatePath("/plaid");
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/flow");
  revalidatePath("/insights");
  revalidatePath("/debt");
  revalidatePath("/net-worth");
}

export async function syncPlaidItemAction(
  plaidRowId: string,
): Promise<{ ok: true } & PlaidSyncResult | { ok: false; error: string }> {
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

export async function syncAllPlaidItemsAction(): Promise<
  { ok: true; results: { institution: string; imported: number }[] } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, error: "Unauthorized" };
  }
  const items = await prisma.plaidItem.findMany({
    where: { userId: session.user.userId },
    select: { id: true, institutionName: true },
  });
  const results: { institution: string; imported: number }[] = [];
  try {
    for (const item of items) {
      const r = await syncPlaidItemTransactions(item.id, session.user.userId);
      results.push({ institution: item.institutionName ?? "Linked account", imported: r.imported });
    }
    revalidatePlaidRelated();
    return { ok: true, results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return { ok: false, error: msg };
  }
}

export async function togglePlaidAccountSyncAction(
  plaidAccountRowId: string,
  syncToExpenses: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, error: "Unauthorized" };
  }
  const account = await prisma.plaidAccount.findFirst({
    where: { id: plaidAccountRowId, plaidItem: { userId: session.user.userId } },
  });
  if (!account) {
    return { ok: false, error: "Account not found." };
  }
  await prisma.plaidAccount.update({
    where: { id: account.id },
    data: { syncToExpenses },
  });
  revalidatePath("/plaid");
  return { ok: true };
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
      await client.itemRemove({ access_token: decryptAccessToken(item.accessToken) });
    } catch {
      // Still drop local row if Plaid revoke fails (e.g. expired item).
    }
  }
  await prisma.plaidItem.delete({ where: { id: item.id } });
  revalidatePlaidRelated();
  return { ok: true };
}
