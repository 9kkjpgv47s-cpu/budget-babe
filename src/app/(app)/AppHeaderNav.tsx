"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type NavLink = { href: string; label: string };

const navGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "Month",
    links: [
      { href: "/", label: "Overview" },
      { href: "/expenses", label: "Expenses" },
      { href: "/bills", label: "Bills" },
      { href: "/budgets", label: "Budgets" },
    ],
  },
  {
    title: "Capture",
    links: [
      { href: "/receipts", label: "Receipts" },
      { href: "/import", label: "Import" },
      { href: "/shopping", label: "Shopping" },
    ],
  },
  {
    title: "Plan",
    links: [
      { href: "/coach", label: "Coach" },
      { href: "/goals", label: "Goals" },
      { href: "/flow", label: "Flow" },
      { href: "/insights", label: "Insights" },
    ],
  },
  {
    title: "Accounts",
    links: [
      { href: "/plaid", label: "Bank sync" },
      { href: "/tax", label: "Tax" },
      { href: "/debt", label: "Debt" },
      { href: "/net-worth", label: "Net worth" },
    ],
  },
];

function hrefWithMonth(href: string, ym: string | null): string {
  if (!ym) return href;
  if (href === "/") return `/?ym=${ym}`;
  return `${href}?ym=${ym}`;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeaderNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ym = searchParams.get("ym")?.match(/^\d{4}-\d{2}$/)
    ? searchParams.get("ym")
    : null;

  return (
    <nav
      className="hidden items-center gap-0.5 overflow-x-auto text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex md:flex-nowrap"
      aria-label="Primary"
    >
      {ym ? (
        <span
          className="mr-1 shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
          title="Month context preserved in links"
        >
          {ym}
        </span>
      ) : null}
      {navGroups.map((group, gi) => (
        <div key={group.title} className="flex shrink-0 items-center gap-0.5">
          {gi > 0 ? (
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          ) : null}
          <span className="sr-only">{group.title}</span>
          {group.links.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={hrefWithMonth(l.href, ym)}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "shrink-0 rounded-lg bg-accent-soft px-2.5 py-1.5 font-semibold text-accent"
                    : "shrink-0 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
