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
}

export function getSessionPassword(): string {
  return sessionPassword();
}
