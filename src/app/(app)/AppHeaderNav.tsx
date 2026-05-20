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
      { href: "/plaid", label: "Plaid" },
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
    <div className="hidden flex-col gap-2 md:flex">
      {ym ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Viewing {ym}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            {" "}
            — month links preserve this context
          </span>
        </p>
      ) : null}
      <nav
        className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm"
        aria-label="Primary"
      >
        {navGroups.map((group, gi) => (
          <div key={group.title} className="flex flex-wrap items-center gap-2">
            {gi > 0 ? (
              <span
                className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 lg:inline-block"
                aria-hidden
              />
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
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
