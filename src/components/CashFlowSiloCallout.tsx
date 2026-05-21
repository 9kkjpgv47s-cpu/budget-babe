import Link from "next/link";

type Variant = "shopping" | "debt" | "net-worth" | "goals";

const copy: Record<
  Variant,
  { title: string; body: string; cta?: { href: string; label: string } }
> = {
  shopping: {
    title: "Shopping memory is separate from monthly spending",
    body: "Trips help you plan and repeat lists. They do not change overview income or “spent so far” until you log the trip total as an expense (button on each trip).",
    cta: { href: "/expenses", label: "Open expenses" },
  },
  debt: {
    title: "Debt balances are tracking-only",
    body: "These accounts do not change overview cash flow, paycheck coach, or budget envelopes. Update balances here for your own snapshot.",
    cta: { href: "/", label: "Monthly overview" },
  },
  "net-worth": {
    title: "Net worth is separate from the monthly ledger",
    body: "Asset and liability accounts here do not feed income, spending, or coach math. Use the overview and Expenses for month-to-month cash flow.",
    cta: { href: "/", label: "Monthly overview" },
  },
  goals: {
    title: "Goal progress is manual",
    body: "Saved amounts are not pulled from bank balances or net worth. Log paychecks and spending on the overview to stay aligned with real cash flow.",
    cta: { href: "/", label: "Monthly overview" },
  },
};

export function CashFlowSiloCallout({
  variant,
  yearMonth,
}: {
  variant: Variant;
  yearMonth?: string;
}) {
  const c = copy[variant];
  const href =
    c.cta && yearMonth?.match(/^\d{4}-\d{2}$/)
      ? c.cta.href === "/"
        ? `/?ym=${yearMonth}`
        : `${c.cta.href}?ym=${yearMonth}`
      : c.cta?.href;

  return (
    <div
      role="note"
      className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <p className="font-medium">{c.title}</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/85">{c.body}</p>
      {c.cta && href ? (
        <p className="mt-2">
          <Link href={href} className="font-medium text-emerald-800 underline dark:text-emerald-300">
            {c.cta.label} →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
