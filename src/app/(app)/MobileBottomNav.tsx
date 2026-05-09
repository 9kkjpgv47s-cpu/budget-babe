"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MobileNavItem = {
  href: string;
  label: string;
};

const items: MobileNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/expenses", label: "Expenses" },
  { href: "/bills", label: "Bills" },
  { href: "/budgets", label: "Budgets" },
  { href: "/coach", label: "Coach" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden"
      aria-label="Primary mobile navigation"
    >
      <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none ${
                  active
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
