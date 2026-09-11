"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { initialFormState } from "@/lib/formActionState";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state?.error ? (
        <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className="text-sm font-medium" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1.5 w-full"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5 w-full"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full !py-3"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
