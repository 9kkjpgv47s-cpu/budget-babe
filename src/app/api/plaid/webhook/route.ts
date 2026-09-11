import { createHash, createPublicKey, createVerify, type JsonWebKey } from "crypto";
import { NextResponse } from "next/server";
import { getPlaidApi } from "@/lib/plaidClient";
import { prisma } from "@/lib/prisma";
import { syncPlaidItemTransactions } from "@/lib/plaidSync";

export const dynamic = "force-dynamic";

const TRANSACTIONS_SYNC_CODES = new Set([
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "DEFAULT_UPDATE",
  "SYNC_UPDATES_AVAILABLE",
]);

const keyCache = new Map<string, { key: ReturnType<typeof createPublicKey>; fetchedAt: number }>();

function decodeJwtPart(part: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Verify Plaid's signed webhook per docs: ES256 JWT in the Plaid-Verification
 * header, key fetched by kid via /webhook_verification_key/get, body must hash
 * to the request_body_sha256 claim, iat within 5 minutes.
 */
async function verifyWebhook(request: Request, rawBody: string): Promise<boolean> {
  const client = getPlaidApi();
  if (!client) return false;
  const token = request.headers.get("plaid-verification");
  if (!token) return false;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return false;
  const header = decodeJwtPart(h);
  const payload = decodeJwtPart(p);
  const kid = typeof header?.kid === "string" ? header.kid : null;
  if (!kid || !payload) return false;

  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  if (Math.abs(Date.now() / 1000 - iat) > 300) return false;

  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  if (payload.request_body_sha256 !== bodyHash) return false;

  const cached = keyCache.get(kid);
  let publicKey = cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000 ? cached.key : null;
  if (!publicKey) {
    try {
      const { data } = await client.webhookVerificationKeyGet({ key_id: kid });
      publicKey = createPublicKey({ key: data.key as unknown as JsonWebKey, format: "jwk" });
      keyCache.set(kid, { key: publicKey, fetchedAt: Date.now() });
    } catch {
      return false;
    }
  }

  const verifier = createVerify("SHA256");
  verifier.update(`${h}.${p}`, "utf8");
  return verifier.verify(
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(sig, "base64url"),
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyWebhook(request, rawBody))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string; display_message?: string; error_message?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = body.item_id;
  if (!itemId) return NextResponse.json({ ok: true });

  const row = await prisma.plaidItem.findUnique({ where: { itemId } });
  if (!row) return NextResponse.json({ ok: true });

  if (body.webhook_type === "ITEM" && body.webhook_code === "ERROR") {
    await prisma.plaidItem.update({
      where: { id: row.id },
      data: {
        lastSyncError:
          body.error?.display_message ??
          body.error?.error_message ??
          body.error?.error_code ??
          "Item error — re-link may be required.",
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (
    body.webhook_type === "TRANSACTIONS" &&
    body.webhook_code &&
    TRANSACTIONS_SYNC_CODES.has(body.webhook_code) &&
    row.userId
  ) {
    try {
      await syncPlaidItemTransactions(row.id, row.userId);
    } catch (e) {
      console.error("[plaid] webhook sync failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
