import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export type PlaidEnvName = "sandbox" | "development" | "production";

function normalizeEnvCredential(raw: string | undefined, key: string): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  // Accept accidental KEY=value pastes from env dashboards.
  const prefix = `${key}=`;
  if (value.startsWith(prefix)) {
    value = value.slice(prefix.length).trim();
  }

  // Accept accidental quoting from copy/paste.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || null;
}

export function getPlaidCredentials(): {
  clientId: string;
  secret: string;
  env: PlaidEnvName;
} | null {
  const clientId = normalizeEnvCredential(process.env.PLAID_CLIENT_ID, "PLAID_CLIENT_ID");
  const secret = normalizeEnvCredential(process.env.PLAID_SECRET, "PLAID_SECRET");
  const raw = (process.env.PLAID_ENV ?? "sandbox").trim().toLowerCase();
  const env = (
    raw === "development" || raw === "production" ? raw : "sandbox"
  ) as PlaidEnvName;
  if (!clientId || !secret) return null;
  return { clientId, secret, env };
}

export function getPlaidApi(): PlaidApi | null {
  const c = getPlaidCredentials();
  if (!c) return null;
  const basePath =
    c.env === "production"
      ? PlaidEnvironments.production
      : c.env === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;
  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": c.clientId,
        "PLAID-SECRET": c.secret,
      },
    },
  });
  return new PlaidApi(configuration);
}
