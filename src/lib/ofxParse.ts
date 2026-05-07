/**
 * Parse OFX (SGML/XML) bank download: extract STMTTRN postings.
 */
export function parseOfxTransactions(text: string): {
  date: Date;
  amountCents: number;
  description: string;
  payee: string | null;
}[] {
  const out: {
    date: Date;
    amountCents: number;
    description: string;
    payee: string | null;
  }[] = [];
  const re = /<STMTTRN>[\s\S]*?<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const block = m[0];
    const amtMatch = /<TRNAMT>([^<]+)</i.exec(block);
    const dateMatch = /<DTPOSTED>([^<]+)</i.exec(block);
    const nameMatch = /<NAME>([^<]*)</i.exec(block);
    const memoMatch = /<MEMO>([^<]*)</i.exec(block);
    if (!amtMatch) continue;
    const n = Number.parseFloat(amtMatch[1].trim());
    if (Number.isNaN(n)) continue;
    const amountCents = Math.round(Math.abs(n) * 100);
    const rawDate = dateMatch?.[1]?.trim() ?? "";
    let date = new Date();
    if (rawDate.length >= 8) {
      const y = Number.parseInt(rawDate.slice(0, 4), 10);
      const mo = Number.parseInt(rawDate.slice(4, 6), 10) - 1;
      const d = Number.parseInt(rawDate.slice(6, 8), 10);
      if (!Number.isNaN(y) && !Number.isNaN(mo) && !Number.isNaN(d)) {
        date = new Date(y, mo, d);
      }
    }
    const name = nameMatch?.[1]?.trim() ?? "";
    const memo = memoMatch?.[1]?.trim() ?? "";
    const description =
      [name, memo].filter(Boolean).join(" — ").slice(0, 500) || "OFX import";
    out.push({
      date,
      amountCents,
      description,
      payee: name || null,
    });
  }
  return out;
}
