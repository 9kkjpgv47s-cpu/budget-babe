/**
 * Parse QIF !Type:Bank (or Cash) blocks — basic D/T/P/N fields.
 */
export function parseQifTransactions(text: string): {
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
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let date = new Date();
  let amountStr = "";
  let payee: string | null = null;
  let memo = "";

  function flush() {
    if (!amountStr.trim()) return;
    const n = Number.parseFloat(amountStr.replace(/[$,]/g, ""));
    if (Number.isNaN(n)) return;
    const amountCents = Math.round(Math.abs(n) * 100);
    const description =
      [payee, memo].filter(Boolean).join(" — ").slice(0, 500) || "QIF import";
    out.push({
      date,
      amountCents,
      description,
      payee,
    });
    amountStr = "";
    payee = null;
    memo = "";
  }

  for (const line of lines) {
    if (line === "^") {
      flush();
      continue;
    }
    const tag = line[0];
    const rest = line.slice(1).trim();
    if (tag === "D") {
      const parts = rest.split(/[/'-]/);
      if (parts.length >= 3) {
        const mo = Number.parseInt(parts[0], 10);
        const d = Number.parseInt(parts[1], 10);
        let y = Number.parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        if (!Number.isNaN(mo) && !Number.isNaN(d) && !Number.isNaN(y)) {
          date = new Date(y, mo - 1, d);
        }
      }
    } else if (tag === "T" || tag === "U") {
      amountStr = rest;
    } else if (tag === "P") {
      payee = rest || null;
    } else if (tag === "M" || tag === "N") {
      memo = rest;
    }
  }
  flush();
  return out;
}
