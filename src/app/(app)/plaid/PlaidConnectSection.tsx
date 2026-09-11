"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export function PlaidConnectSection({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // OAuth institutions (Chase, BofA, …) bounce the browser to PLAID_REDIRECT_URI
  // with ?oauth_state_id=… — capture it once so Link can resume.
  const [oauthRedirectUri] = useState<string | null>(() =>
    typeof window !== "undefined" &&
    window.location.href.includes("oauth_state_id")
      ? window.location.href
      : null,
  );

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setMessage(data.error ?? "Could not save bank link.");
          return;
        }
        setLinkToken(null);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: oauthRedirectUri ? null : linkToken,
    receivedRedirectUri: oauthRedirectUri ?? undefined,
    onSuccess,
    onExit: () => {
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (ready && (linkToken || oauthRedirectUri)) {
      open();
    }
  }, [linkToken, oauthRedirectUri, ready, open]);

  async function startLink() {
    if (!configured) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/create_link_token", { method: "POST" });
      const data = (await res.json()) as { link_token?: string; error?: string };
      if (!res.ok || !data.link_token) {
        setMessage(data.error ?? "Could not start Plaid Link.");
        return;
      }
      setLinkToken(data.link_token);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Plaid is not configured on this server.</p>
        <p className="mt-2 text-amber-900/90 dark:text-amber-100/80">
          Set real values for <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">PLAID_CLIENT_ID</code> and{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">PLAID_SECRET</code> from the{" "}
          Plaid Dashboard (Team Settings → Keys), matching <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">PLAID_ENV</code>{" "}
          (<span className="whitespace-nowrap">sandbox</span>, development, or production). Placeholder values count as
          &quot;not configured&quot; — update them in Vercel env vars and redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void startLink()}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        {busy ? "Starting…" : "Connect a bank (Plaid Link)"}
      </button>
      {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
      <p className="text-sm text-muted-foreground">
        Sandbox: use{" "}
        <a
          className="text-accent underline "
          href="https://plaid.com/docs/sandbox/users/"
          target="_blank"
          rel="noreferrer"
        >
          Plaid test credentials
        </a>
        . Transactions import as expenses on the next sync (pending charges are skipped).
      </p>
    </div>
  );
}
