# State-of-the-art gaps — Household Budget vs leading apps

Comparison against **Mint**, **YNAB**, **Monarch Money**, and **Copilot**-class products. This app is a **two-person household ledger**, not a neobank — many enterprise features are intentionally out of scope.

## In scope today (differentiators)

| Capability | Status |
|------------|--------|
| Two-user household, shared month ledger | Shipped |
| Receipt OCR + line-item batch post | Shipped |
| Tax workpaper + IRC guidance + CSV export | Shipped |
| Paycheck coach (savings %, two-week bill window) | Shipped |
| Plaid transaction sync → expenses | Shipped |
| CSV / OFX / QIF import + merchant rules | Shipped |
| PWA offline shell | Shipped |
| Retroactive merchant rule apply (per month) | Shipped (Agent 4) |

## P0 — High value, fits household scope

| Feature | Mint / YNAB / Monarch | Our status |
|---------|----------------------|------------|
| Unified month context on all links | Standard | Partial — header preserves `?ym=` when present |
| Income one number everywhere | Standard | Partial — paycheck sum vs legacy field |
| Receipt on primary capture surfaces | Monarch/Copilot strong | Partial — `/receipts` + overview link |
| OCR prefill into expense form | Copilot-like | Partial — async refresh |
| Form reset after save | Standard | Planned (Agent 3) |
| Budget pick at quick entry | YNAB envelope | **Shipped** — Quick Add optional envelope |
| Retroactive categorization rules | Mint rules | **Shipped** — Apply rules to month |

## P1 — Medium effort, still household-relevant

| Feature | Competitors | Our status |
|---------|-------------|------------|
| Recurring transaction detection | All major apps | Not built |
| Budget overspend alerts (in-app) | YNAB, Monarch | Not built |
| Web push bill reminders | Mint, banks | Roadmap only |
| Split transaction on manual entry | YNAB | Import/split wizard only |
| Profile edit (name/email) | Standard | Register-only |
| Pay stub OCR progress UI | — | Silent best-effort |
| Shopping trip → expense | — | **Shipped** — per-trip button posts to month ledger |
| Plaid → default budget envelope | Monarch rules | Not built (no schema) |

## P2 — Larger builds

| Feature | Competitors | Our status |
|---------|-------------|------------|
| Real-time multi-device sync | Cloud apps | Server revalidate only |
| Investment / brokerage accounts | Monarch, Mint | Out of scope |
| Credit score | Mint | Out of scope |
| Bill pay / ACH | Banks | Out of scope |
| Multi-currency | International apps | Single currency implied |
| AI natural-language entry | Copilot 2024+ | Not built |

## Intentional silos (documented, not bugs)

These modules **do not** change overview income, spent, or coach math unless you enter data manually elsewhere:

| Module | Stored as | Cash-flow impact |
|--------|-----------|------------------|
| **Shopping trips** | `ShoppingTrip` + items | Optional **Log as expense** per trip; otherwise memory only |
| **Debt accounts** | `DebtAccount` balances | Tracking only |
| **Net worth** | `NetWorthAccount` + snapshots | Tracking only |
| **Savings goals** | `SavingsGoal.savedAmountCents` | Manual progress, not bank-linked |

## Agent 4 integration outcomes (2026-05-20)

- Merchant rules: **Apply to this month’s expenses** on Import
- Coach: household snapshot mirrors overview income + next payday
- Overview: link to coach settings
- Quick Add: optional budget envelope
- Plaid sync: CTA to Expenses after import
- Header nav: grouped links + month context when `?ym=` present
- Shopping → expense bridge + silo callouts on tracking-only pages
- Import post-success next steps (rules + budgets); goals cash-flow context panel
- Month workflow links on Import, Plaid, Flow, Insights, Goals

## Recommended next epics (post four-agent plan)

1. Agent 1 — `monthLinks` + unified income in trends  
2. Agent 2 — Receipt in mobile nav + Quick Add scan  
3. Agent 3 — Form reset / controlled tax fields  
4. Split shopping line items into multiple expenses (optional)
