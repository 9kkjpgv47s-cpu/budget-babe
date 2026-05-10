"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-900 dark:text-zinc-50">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Try signing out and signing back in. If this keeps happening, open{" "}
        <strong>/api/health</strong> on this deployment — check{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">database</code>{" "}
        and{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          sessionConfigured
        </code>
        , then review Vercel runtime logs.
      </p>
      {process.env.NODE_ENV === "development" ? (
        <pre className="mt-6 overflow-x-auto rounded bg-red-50 p-3 text-left text-xs text-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
      ) : null}
      <button
        type="button"
        className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
