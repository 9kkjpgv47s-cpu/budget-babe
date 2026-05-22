import { parseMoneyToCents } from "@/lib/money";

export type ParsedReceiptLine = {
  description: string;
  amountCents: number | null;
};

/** US 1,234.56 and EU 1.234,56 / 12,34 style amounts on receipt lines. */
export function parseReceiptLineAmountCents(rawAmount: string): number | null {
  const s = rawAmount.replace(/[\$€£\s]/g, "").trim();
  if (!s) return null;
  const euFull = s.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (euFull) {
    return parseMoneyToCents(`${euFull[1]!.replace(/\./g, "")}.${euFull[2]}`);
  }
  const euShort = s.match(/^(\d+),(\d{2})$/);
  if (euShort && !s.includes(".")) {
    return parseMoneyToCents(`${euShort[1]}.${euShort[2]}`);
  }
  return parseMoneyToCents(s.replace(/,/g, ""));
}

/**
 * Pull likely line items: text ending in a currency amount.
 */
export function parseReceiptLines(raw: string): ParsedReceiptLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const amountTail =
    /\s+(-?[\$€£]?\s*(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}))\s*$/;
  const out: ParsedReceiptLine[] = [];

  const skipDesc =
    /^(?:sub\s*total|subtotal|total|tax|sales\s*tax|vat|tip|gratuity|change|cash|card|balance\s*due|amount\s*due)$/i;

  for (const line of lines) {
    const m = line.match(amountTail);
    if (!m) continue;
    const desc = line.slice(0, m.index).trim();
    const amountCents = parseReceiptLineAmountCents(m[1]!);
    if (!desc || desc.length < 2) continue;
    if (desc.length > 200) continue;
    if (skipDesc.test(desc)) continue;
    out.push({ description: desc, amountCents });
  }

  return out;
}

const MERCHANT_SKIP =
  /^(?:welcome|thank\s*you|thanks|store|receipt|invoice|customer\s*copy|merchant\s*copy|tel|phone|www\.|http|visa|mastercard|amex|discover|debit|credit|auth|approval|cashier|register|trans\s*#|transaction)/i;

/**
 * Best-effort merchant / store name from the top of OCR text (for expense description).
 */
export function parseMerchantFromOcrText(rawText: string): string | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 80);
  let best: { line: string; score: number } | null = null;
  for (const line of lines.slice(0, 14)) {
    if (MERCHANT_SKIP.test(line)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}/.test(line)) continue;
    if (/^[\d\s\-+().#]+$/.test(line)) continue;
    if (!/[a-zA-Z]/.test(line)) continue;
    const cleaned = line.replace(/\s{2,}/g, " ").slice(0, 120);
    if (cleaned.length < 3) continue;
    const letters = (cleaned.match(/[a-zA-Z]/g) ?? []).length;
    const digits = (cleaned.match(/\d/g) ?? []).length;
    let score = letters - digits * 2;
    if (/^[A-Z0-9\s&'.-]+$/.test(cleaned) && letters >= 4) score += 4;
    if (cleaned.length <= 40) score += 2;
    if (!best || score > best.score) best = { line: cleaned, score };
  }
  return best?.line ?? null;
}

export function defaultExpenseDescriptionFromReceipt(
  rawText: string,
  parsedLines: ParsedReceiptLine[],
  filenameLabel: string,
): string {
  const merchant = parseMerchantFromOcrText(rawText);
  if (merchant) return merchant;
  const first = parsedLines.find(
    (l) => l.description?.trim() && (l.amountCents ?? 0) > 0,
  );
  if (first?.description?.trim()) return first.description.trim().slice(0, 500);
  return `Receipt: ${filenameLabel}`;
}

export function parseLikelyTotalCents(raw: string): number | null {
  const upper = raw.toUpperCase();
  const amountChunk = String.raw`([\d\s.,€£$]+)`;
  const patterns = [
    new RegExp(`TOTAL[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
    new RegExp(`AMOUNT\\s+DUE[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
    new RegExp(`BALANCE[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
    new RegExp(`GRAND\\s*TOTAL[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
    new RegExp(`${amountChunk}\\s+TOTAL\\b`, "i"),
    new RegExp(`^[$€£]?\\s*${amountChunk}\\s*$`, "m"),
  ];
  for (const re of patterns) {
    const m = upper.match(re) ?? raw.match(re);
    if (m?.[1]) {
      const cents = parseReceiptLineAmountCents(m[1]);
      if (cents != null && cents > 0 && cents < 1_000_000_00) return cents;
    }
  }
  return null;
}
