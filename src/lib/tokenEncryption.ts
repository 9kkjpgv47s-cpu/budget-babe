import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { getSessionPassword } from "@/lib/env";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    const buf = Buffer.from(raw, "utf8");
    if (buf.length >= 32) return buf.subarray(0, 32);
  }
  return scryptSync(getSessionPassword(), "household-plaid-token-v1", 32);
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt Plaid access tokens (and similar secrets) at rest. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncryptedToken(stored)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
