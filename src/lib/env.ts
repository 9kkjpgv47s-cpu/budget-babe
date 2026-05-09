function sessionPassword(): string {
  const p = process.env.SESSION_PASSWORD;
  if (p && p.length >= 32) return p;
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-session-secret-min-32-chars!!";
  }
  throw new Error(
    "Set SESSION_PASSWORD in the environment (at least 32 characters) for production.",
  );
}

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const p = process.env.SESSION_PASSWORD;
  if (!p || p.length < 32) {
    throw new Error(
      "Set SESSION_PASSWORD in the environment (at least 32 characters) for production.",
    );
  }
  if (
    process.env.VERCEL &&
    process.env.DATABASE_URL?.startsWith("file:")
  ) {
    throw new Error(
      "SQLite file DATABASE_URL does not work on Vercel serverless. Use a hosted Postgres URL (Neon, Supabase, Vercel Postgres, …).",
    );
  }
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      "[household-budget] BLOB_READ_WRITE_TOKEN is not set: receipts/pay stubs will try local disk on ephemeral Functions storage and may disappear after deploy. Add Vercel Blob from the dashboard.",
    );
  }
}

export function getSessionPassword(): string {
  return sessionPassword();
}
