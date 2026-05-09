type MaybePlaidResponse = {
  status?: number;
  data?: Record<string, unknown>;
};

type MaybePlaidError = {
  message?: string;
  response?: MaybePlaidResponse;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function formatPlaidError(error: unknown, action: string): string {
  const e = error as MaybePlaidError;
  const status = e.response?.status;
  const data = e.response?.data ?? {};

  const errorCode = asString(data.error_code);
  const errorType = asString(data.error_type);
  const errorMessage =
    asString(data.display_message) ??
    asString(data.error_message) ??
    asString(e.message) ??
    "Unknown Plaid error";

  const parts = [
    `Plaid ${action} failed`,
    status ? `(HTTP ${status})` : null,
    errorCode ? `[${errorCode}]` : null,
    errorType ? errorType : null,
  ].filter(Boolean);

  let hint = "";
  if (status === 400 || errorCode === "INVALID_API_KEYS") {
    hint =
      " Check that PLAID_CLIENT_ID/PLAID_SECRET are valid and PLAID_ENV matches that key pair (sandbox vs development vs production).";
  }

  return `${parts.join(" ")}: ${errorMessage}.${hint}`;
}
