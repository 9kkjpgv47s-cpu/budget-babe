import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { AppHeaderNav } from "./AppHeaderNav";
import { MobileBottomNav } from "./MobileBottomNav";

/** Prisma requires Node.js; keep authenticated routes off Edge by default. */
export const runtime = "nodejs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-accent-foreground shadow-sm">
              B
            </span>
            <span className="hidden lg:inline">Budget Babe</span>
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <AppHeaderNav />
            </Suspense>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" title={user.name}>
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-6 pb-28 md:px-4 md:py-8 md:pb-10">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
