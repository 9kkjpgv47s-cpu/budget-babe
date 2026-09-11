"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MobileNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const items: MobileNavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    href: "/bills",
    label: "Bills",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 9.5h18" />
        <path d="M12 13v4M10 15h4" />
      </svg>
    ),
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M12 3a9 9 0 0 1 9 9h-9V3Z" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden"
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
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-semibold transition-all duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
