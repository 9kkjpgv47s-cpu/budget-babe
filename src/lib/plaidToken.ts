import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

/**
 * AES-256-GCM at-rest encryption for Plaid access tokens.
 * Enabled when PLAID_TOKEN_ENC_KEY is set (32-byte key as 64 hex chars or base64).
 * Rows written before encryption was enabled stay plaintext and still decrypt.
 */
function encKey(): Buffer | null {
  const raw = process.env.PLAID_TOKEN_ENC_KEY?.trim();
  if (!raw) return null;
  try {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function encryptAccessToken(plain: string): string {
  const key = encKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptAccessToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = encKey();
  if (!key) {
    throw new Error("Plaid access token is encrypted but PLAID_TOKEN_ENC_KEY is missing.");
  }
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
