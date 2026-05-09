import {
  extractMoneyDocumentFromBuffer,
  parseLikelyTotalCents,
} from "@/lib/receiptOcr";
import { parseMoneyToCents } from "@/lib/money";

/**
 * Guess net/take-home pay from OCR text (pay stubs use varied layouts).
 */
export function parseLikelyPaystubNetCents(raw: string): number | null {
  const fromReceipt = parseLikelyTotalCents(raw);
  if (fromReceipt != null) return fromReceipt;

  const patterns = [
    /NET\s+PAY[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /NET\s+AMOUNT[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /NET\s+PAY\s+THIS\s+PERIOD[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /TAKE[\s-]*HOME[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /DEPOSIT\s+AMOUNT[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /AMOUNT\s+PAID[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /PAY\s+THIS\s+PERIOD[:\s]*\$?\s*([\d,]+\.\d{2})/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const cents = parseMoneyToCents(m[1].replace(/,/g, ""));
      if (cents != null && cents > 0 && cents < 1_000_000_00) return cents;
    }
  }

  return null;
}

export async function guessPaystubAmountFromBuffer(
  buffer: Buffer,
  filenameForExt: string,
): Promise<number | null> {
  const extracted = await extractMoneyDocumentFromBuffer(buffer, filenameForExt);
  if (!extracted.ok) return null;
  return parseLikelyPaystubNetCents(extracted.text);
}
