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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
              Household Budget
            </Link>
            <Suspense fallback={null}>
              <AppHeaderNav />
            </Suspense>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-5 pb-28 md:px-4 md:py-8 md:pb-8">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
