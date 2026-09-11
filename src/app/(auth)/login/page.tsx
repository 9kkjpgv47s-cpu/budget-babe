import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -left-24 bottom-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <div className="card p-6 shadow-pop md:p-8" style={{ boxShadow: "var(--shadow-pop)" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-base font-bold text-accent-foreground">
            B
          </span>
          <span className="font-semibold tracking-tight">Budget Babe</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Household budget — up to two accounts.
        </p>
        <LoginForm registered={Boolean(sp.registered)} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link className="font-medium text-accent hover:underline" href="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
