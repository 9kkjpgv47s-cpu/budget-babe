import { decryptSecret, encryptSecret, isEncryptedToken } from "@/lib/tokenEncryption";

export function getPlaidAccessToken(stored: string): string {
  return decryptSecret(stored);
}

export function storePlaidAccessToken(plaintext: string): string {
  return encryptSecret(plaintext);
}

/** Re-encrypt legacy plaintext tokens on read paths (optional migration helper). */
export function ensurePlaidTokenEncrypted(stored: string): string | null {
  if (isEncryptedToken(stored)) return null;
  return storePlaidAccessToken(stored);
}
