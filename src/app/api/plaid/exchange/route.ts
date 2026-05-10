import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getPlaidApi } from "@/lib/plaidClient";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const client = getPlaidApi();
  if (!client) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }
  let body: { public_token?: string };
  try {
    body = (await request.json()) as { public_token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const public_token = body.public_token?.trim();
  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }
  try {
    const { data } = await client.itemPublicTokenExchange({ public_token });
    const access_token = data.access_token;
    const item_id = data.item_id;
    const itemResp = await client.itemGet({ access_token });
    const it = itemResp.data.item;
    const institutionName = it.institution_name ?? "Linked account";
    await prisma.plaidItem.create({
      data: {
        itemId: item_id,
        accessToken: access_token,
        institutionId: it.institution_id ?? null,
        institutionName,
        userId: session.user.userId,
      },
    });
    revalidatePath("/plaid");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Exchange failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
