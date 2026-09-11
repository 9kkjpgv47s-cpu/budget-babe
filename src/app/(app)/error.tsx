"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-negative">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Try signing out and signing back in. If this keeps happening, open{" "}
        <strong>/api/health</strong> on this deployment — check{" "}
        <code className="rounded bg-muted px-1 dark:bg-zinc-800">database</code>{" "}
        and{" "}
        <code className="rounded bg-muted px-1 dark:bg-zinc-800">
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
        className="btn btn-primary mt-6"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
