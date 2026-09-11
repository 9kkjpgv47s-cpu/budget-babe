"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { initialFormState } from "@/lib/formActionState";

export function LoginForm({ registered }: { registered?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {registered ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-accent">
          Account created. You can sign in now.
        </p>
      ) : null}
      {state?.error ? (
        <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 w-full"
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
