import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export type PlaidEnvName = "sandbox" | "development" | "production";

export function getPlaidCredentials(): {
  clientId: string;
  secret: string;
  env: PlaidEnvName;
} | null {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
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
