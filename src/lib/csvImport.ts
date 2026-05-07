/**
 * Minimal CSV row parser (handles double-quoted fields with commas).
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((x) => x.length > 0)) rows.push(row);
  return rows;
}

export type ColumnMap = {
  date?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  description?: number;
  payee?: number;
};

const HEADER_SYNONYMS: Record<string, keyof ColumnMap> = {
  date: "date",
  posted: "date",
  "transaction date": "date",
  transdate: "date",
  amount: "amount",
  debit: "debit",
  credit: "credit",
  description: "description",
  memo: "description",
  details: "description",
  payee: "payee",
  merchant: "payee",
  name: "payee",
};

export function detectColumns(headerRow: string[]): ColumnMap {
  const map: ColumnMap = {};
  headerRow.forEach((h, idx) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, " ");
    const norm = key.replace(/[^a-z0-9 ]/g, "");
    const syn =
      HEADER_SYNONYMS[norm] ??
      (HEADER_SYNONYMS[key as keyof typeof HEADER_SYNONYMS] as
        | keyof ColumnMap
        | undefined);
    if (syn && map[syn] === undefined) map[syn] = idx;
  });
  return map;
}

export function rowToExpenseParts(
  cells: string[],
  map: ColumnMap,
): { date: Date; amountCents: number; description: string; payee: string | null } | null {
  const get = (j?: number) => (j != null && j < cells.length ? cells[j].trim() : "");
  const dateStr = get(map.date);
  let amountStr = get(map.amount);
  if (map.debit != null || map.credit != null) {
    const d = get(map.debit).replace(/[$,]/g, "");
    const cr = get(map.credit).replace(/[$,]/g, "");
    if (d && Number.parseFloat(d)) amountStr = d.startsWith("-") ? d : `-${d}`;
    else if (cr && Number.parseFloat(cr)) amountStr = cr;
  }
  const desc = get(map.description) || get(map.payee) || "Imported";
  const payee = get(map.payee) || null;
  if (!amountStr) return null;
  const n = Number.parseFloat(amountStr.replace(/[$,]/g, ""));
  if (Number.isNaN(n)) return null;
  const amountCents = Math.round(Math.abs(n) * 100);
  let date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();
  return { date, amountCents, description: desc.slice(0, 500), payee };
}
