import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -left-24 bottom-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <div className="card p-6 md:p-8" style={{ boxShadow: "var(--shadow-pop)" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-base font-bold text-accent-foreground">
            B
          </span>
          <span className="font-semibold tracking-tight">Budget Babe</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          This app is for two people in one household. The second person can
          register the same way (until two accounts exist).
        </p>
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-accent hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
