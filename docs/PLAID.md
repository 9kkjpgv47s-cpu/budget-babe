# Plaid bank sync — what it pulls, limits, setup

## What syncs automatically

| Plaid product | Data | Where it lands |
|---|---|---|
| Transactions (default) | Posted transactions, up to **24 months** history (`days_requested: 730`), merchant-enriched, auto-categorized | `/expenses` |
| Balance (free with any item) | Current/available balance per account | `/net-worth` rows auto-created/updated |
| Liabilities (opt-in) | Credit card APR + min payment, mortgage/student/auto loan terms | `/debt` rows auto-created/updated |
| Investments (opt-in) | Investment account balances (holdings detail not yet used) | `/net-worth` |
| Webhooks | `TRANSACTIONS` updates → auto-sync, no button press | — |

## What does NOT auto-pull

- **Deposits/income** — inflows are skipped on purpose (paychecks stay manual in Paychecks; a future "suggest paycheck from deposit" could close this).
- **Transfers between your own accounts** — Plaid's `TRANSFER_*`/`LOAN_PAYMENTS` categories are skipped to avoid double counting (e.g. a credit-card payment showing on both checking and the card).
- **Cash spending** — no data exists to pull.
- **Pending charges** — skipped until they post (1–5 business days; Capital One and USAA never send pending data).
- **Receipt line items** — the receipt OCR feature covers that.

## Per-account control

Each linked account appears under its institution on `/plaid` with a **"to expenses"** toggle — turn off savings accounts, cards you don't want tracked, etc. Balances still update net worth regardless.

## Limits to know

- `days_requested` is locked when an item is linked — links created before this change only have 90 days; **disconnect and re-link** to get the full 2 years.
- Transaction refresh is 1–4×/day per institution, not real-time. `SYNC_UPDATES_AVAILABLE` webhooks make sync automatic when `PLAID_WEBHOOK_URL` is set.
- Capital One only provides 90 days of history regardless of `days_requested`.
- Transaction history beyond 24 months does not exist via Plaid (or anyone — use CSV import for older data).

## Cost

- **Trial plan (US/CA, post-April-2026 signups): free, real data, up to 10 items**, bundles Transactions+Refresh, Balance, Liabilities, Investments, Statements, Auth, Identity, Assets. A 2-person household fits inside it.
- Sandbox: free fake data, unlimited items.
- Paid production: monthly per-item subscription for Transactions/Liabilities/Investments (~$0.30–0.50/item/mo); Balance is per-request; Auth/Identity one-time.

## Env vars

```bash
PLAID_CLIENT_ID=            # dashboard.plaid.com
PLAID_SECRET=
PLAID_ENV=sandbox           # sandbox | development | production

PLAID_WEBHOOK_URL=          # https://<app>/api/plaid/webhook — enables auto-sync
PLAID_TOKEN_ENC_KEY=        # 64-hex or base64 32-byte key — encrypts access tokens at rest
PLAID_OPTIONAL_PRODUCTS=liabilities,investments   # unlocks Debt auto-fill (needs product access on your Plaid team)
```

## Alternatives considered

- **SimpleFIN Bridge** ($1.50/mo, user-paid, MX underneath, daily sync only) — fine cheap fallback, less depth.
- **MX / Finicity / Yodlee** — sales-gated, built for apps with thousands of users.
- **Stripe Financial Connections** — verification-oriented, weak for ongoing PFM sync.
