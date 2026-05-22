/**
 * Lightweight checks for receipt line/total parsers (no test runner required).
 * Logic mirrors src/lib/receiptParse.ts — update both when parsers change.
 * Run: npm run test:receipt-parse
 */
import assert from "node:assert/strict";

function parseMoneyToCents(input) {
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseReceiptLineAmountCents(rawAmount) {
  const s = rawAmount.replace(/[\$€£\s]/g, "").trim();
  if (!s) return null;
  const euFull = s.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (euFull) {
    return parseMoneyToCents(`${euFull[1].replace(/\./g, "")}.${euFull[2]}`);
  }
  const euShort = s.match(/^(\d+),(\d{2})$/);
  if (euShort && !s.includes(".")) {
    return parseMoneyToCents(`${euShort[1]}.${euShort[2]}`);
  }
  return parseMoneyToCents(s.replace(/,/g, ""));
}

function parseReceiptLines(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const amountTail =
    /\s+(-?[\$€£]?\s*(?:\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}))\s*$/;
  const out = [];
  const skipDesc =
    /^(?:sub\s*total|subtotal|total|tax|sales\s*tax|vat|tip|gratuity|change|cash|card|balance\s*due|amount\s*due)$/i;
  for (const line of lines) {
    const m = line.match(amountTail);
    if (!m) continue;
    const desc = line.slice(0, m.index).trim();
    const amountCents = parseReceiptLineAmountCents(m[1]);
    if (!desc || desc.length < 2) continue;
    if (skipDesc.test(desc)) continue;
    out.push({ description: desc, amountCents });
  }
  return out;
}

function parseLikelyTotalCents(raw) {
  const upper = raw.toUpperCase();
  const amountChunk = String.raw`([\d\s.,€£$]+)`;
  const patterns = [
    new RegExp(`TOTAL[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
    new RegExp(`AMOUNT\\s+DUE[:\\s]+[$€£]?\\s*${amountChunk}`, "i"),
  ];
  for (const re of patterns) {
    const m = upper.match(re) ?? raw.match(re);
    if (m?.[1]) {
      const cents = parseReceiptLineAmountCents(m[1]);
      if (cents != null && cents > 0) return cents;
    }
  }
  return null;
}

function parseMerchantFromOcrText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 80);
  let best = null;
  for (const line of lines.slice(0, 14)) {
    if (!/[a-zA-Z]/.test(line)) continue;
    const cleaned = line.replace(/\s{2,}/g, " ").slice(0, 120);
    if (!best || cleaned.length > best.line.length) best = { line: cleaned };
  }
  return best?.line ?? null;
}

assert.equal(parseReceiptLineAmountCents("12.34"), 1234);
assert.equal(parseReceiptLineAmountCents("1,234.56"), 123456);
assert.equal(parseReceiptLineAmountCents("12,34"), 1234);

const lines = parseReceiptLines(
  ["COFFEE SHOP", "LATTE 4.50", "MUFFIN 3,25", "SUBTOTAL 7.75", "TOTAL 7.75"].join(
    "\n",
  ),
);
assert.ok(lines.some((l) => l.description.includes("LATTE")));
assert.ok(!lines.some((l) => /subtotal/i.test(l.description)));

const total = parseLikelyTotalCents("TOTAL: $42.18\n");
assert.equal(total, 4218);
assert.equal(parseLikelyTotalCents("TOTAL: 42,18\n"), 4218);

const merchant = parseMerchantFromOcrText("WHOLE FOODS MARKET\n123 Main St\n");
assert.equal(merchant, "WHOLE FOODS MARKET");

function inferTotalFromParsedLines(lines) {
  const amounts = lines
    .map((l) => l.amountCents)
    .filter((c) => typeof c === "number" && c > 0);
  if (amounts.length < 2) return null;
  const sum = amounts.reduce((a, b) => a + b, 0);
  return sum > 0 ? sum : null;
}

const sumTotal = inferTotalFromParsedLines([
  { description: "A", amountCents: 450 },
  { description: "B", amountCents: 325 },
]);
assert.equal(sumTotal, 775);

console.log("receipt parse checks: ok");
