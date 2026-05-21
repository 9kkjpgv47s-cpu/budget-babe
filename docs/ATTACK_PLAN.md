# Financial app audit & 4-agent attack plan

**Repo:** Household Budget PWA (Next.js 15, Prisma, PostgreSQL)  
**Goal:** State-of-the-art household finance UX — especially **one entry propagates everywhere** and **receipt capture → parsed expenses** feels first-class, not buried.

This document is the **single coordination contract** for four parallel agents. Follow ownership rules strictly to avoid merge conflicts.

---

## Executive audit summary

### What is already strong (shipped)

| Area | Status | Key paths |
|------|--------|-----------|
| Core ledger | Expenses, bills, paychecks, monthly periods | `prisma/schema.prisma`, `src/app/actions/*` |
| Receipt OCR pipeline | Upload → Tesseract/pdf-parse → parsed lines + total | `src/lib/receiptOcr.ts`, `src/app/actions/receipts.ts` |
| Receipt → expenses | Single post + batch split group | `ReceiptPostExpenseForm.tsx`, `ReceiptBatchExpensesForm.tsx` |
| Pay stub OCR | Best-effort net amount on paycheck upload | `src/lib/paystubOcr.ts`, `QuickForms.tsx` |
| Bank import | CSV/OFX/QIF, Plaid sync | `src/app/(app)/import/`, `src/lib/plaidSync.ts` |
| Tax workpaper | Applicability, IRC guidance, export | `src/app/(app)/tax/` |
| PWA | Offline shell (Serwist) | `src/sw.ts`, `src/app/~offline/` |

### Why receipt capture “feels missing” (root cause — not deleted code)

The feature **exists** on `/receipts` but is **under-surfaced**:

1. **Mobile bottom nav** (`MobileBottomNav.tsx`) has Home / Expenses / Bills / Budgets / Coach — **no Receipts**.
2. **Overview receipts block** (`page.tsx` ~594–625) only links to the **image file** (`/api/receipts/:id`), not to OCR status or “post as expense” — users never see parsing UI from home.
3. **Quick add** (`QuickForms.tsx`) has no “scan receipt” entry type; camera capture lives only on `/receipts`.
4. **No global month context** — month is `?ym=` per page or hidden `yearMonth`; changing month on overview does not carry to `/receipts` without manual URL editing.
5. **OCR is server-only** with `router.refresh()` polling (90s cap) — slow jobs feel stuck unless user stays on `/receipts`.

### Why “one field doesn’t populate the app” (architectural gap)

There is **no shared client or server session for in-progress entry**:

| Pattern today | Limitation |
|---------------|------------|
| Server Components + `revalidatePath` | Data syncs **after submit**, not while typing |
| Per-form hidden `yearMonth` | Month diverges across tabs/routes |
| `useActionState` only | No cross-page draft or “last payee” memory |
| Merchant rules at write time | Tags/budget hints don’t appear in other forms until saved |
| Budget match via description text | No canonical **Category** entity; envelopes matched heuristically |

**State-of-the-art target:** Household-scoped **entry context** (month, last merchant, default budget envelope, receipt draft) readable by every form; receipt OCR pre-fills expense forms app-wide.

### Gap analysis vs state-of-the-art finance apps

| Capability | This app | Typical SOTA (Mint/YNAB/Copilot-class) |
|------------|----------|----------------------------------------|
| Receipt → line items | Heuristic OCR lines | ML + merchant/date extraction, editable lines |
| Cross-form continuity | None | Global month + smart defaults + linked accounts |
| Categories | Budget match strings + tax folders | Canonical categories with rules |
| Real-time OCR feedback | Refresh polling | SSE or job status + push |
| Reports | Split across insights/flow/tax | Unified reports + trends |
| Account balances | Manual net worth; Plaid = transactions only | Live balance per linked account |
| Split transactions | Receipt batch + import wizard | Inline split on any expense |
| Recurring detection | Insights hints | Auto-bill + subscription detection |
| Security | Plaid tokens plaintext in DB | Encrypted secrets, audit log |

Prioritized for this codebase (photos-first roadmap in `ROADMAP.md`):

1. **P0** — Unified month + entry context; receipt capture on home/mobile nav; OCR → expense pre-fill everywhere  
2. **P1** — Editable OCR lines; auto budget/category from merchant rules; dedicated reports slice  
3. **P2** — Stronger OCR (optional vision API); Plaid token encryption; web push bill reminders  

---

## Parallel work rules (all agents)

### Merge order (base → tip)

```
main
 └── agent-1-unified-context     (merge first — others depend on APIs)
      ├── agent-2-receipts-ux    (can merge after 1’s MonthProvider ships)
      ├── agent-3-ledger-categories
      └── agent-4-reports-platform
```

**Agent 1 must land `MonthProvider` + `useHouseholdMonth()` before Agents 2–4 change page month handling.**

### Global deny list (no agent touches without escalation)

| Path | Reason |
|------|--------|
| `package.json`, `package-lock.json` | Dependency wars — one designated “platform” PR if needed |
| `prisma/migrations/*` (except owner) | Only one agent per migration tranche |
| `next.config.ts`, `vercel.json` | Deploy risk |
| Another agent’s **owned directory** | See charters below |

### Shared file protocol (hot files)

If you must touch a **shared** file, open a PR comment tagging the file and **only append** (no drive-by refactors):

| File | Owner for edits | Others may |
|------|-----------------|------------|
| `src/app/(app)/layout.tsx` | Agent 1: wrap providers | Agent 2: **one line** in `links` / mobile nav via separate commit |
| `src/app/(app)/page.tsx` | Agent 2: receipts section (~594–625) | Agent 1: month selector block at top only |
| `prisma/schema.prisma` | Agent 3: `Category` model + Expense FK | Agent 4: **no schema** unless security columns agreed in issue |

### Branch naming

```
cursor/agent-1-unified-context-3a44
cursor/agent-2-receipts-ux-3a44
cursor/agent-3-ledger-categories-3a44
cursor/agent-4-reports-platform-3a44
```

---

## Agent 1 — Unified context & cross-app propagation

**Mission:** One household month and one “entry defaults” surface used by every form. Typing once should pre-fill the next form on any page.

### Owns (exclusive write)

```
src/context/                          # NEW — create entire tree
  MonthProvider.tsx
  EntryDefaultsProvider.tsx
  hooks.ts
src/components/shared/                # NEW
  MonthSelector.tsx
  EntryDefaultsHint.tsx
src/lib/householdContext.ts           # NEW — server helpers: get/set cookie or DB prefs
src/app/(app)/layout.tsx              # Wrap children with providers only
```

### May read / integrate (do not refactor unrelated logic)

- All `src/app/(app)/**/page.tsx` — replace ad-hoc `?ym=` parsing with `useHouseholdMonth()` + redirect helper
- `src/lib/yearMonth.ts` — extend, don’t fork

### Must not touch

- `src/app/(app)/receipts/**` (Agent 2)
- `src/lib/receiptOcr.ts`, `src/app/actions/receipts.ts` (Agent 2)
- `prisma/schema.prisma` (Agent 3)
- `src/app/(app)/insights/**`, `src/app/api/export/**` (Agent 4)

### Deliverables

1. **`MonthProvider`** — persists `YYYY-MM` in URL (`?ym=`) + cookie fallback; changing month updates link hrefs app-wide via helper `withYearMonth(href, ym)`.
2. **`EntryDefaultsProvider`** — after any successful expense/receipt post (listen via custom event or server-returned defaults), store:
   - `lastPayee` / `lastDescription`
   - `lastBudgetPlanId` (if set)
   - `lastTags[]`
3. **`MonthSelector`** in app header (layout) — visible on mobile + desktop.
4. Migration checklist (Agent 1 completes): every form with hidden `yearMonth` uses provider value.

### Acceptance criteria

- [ ] Change month in header → `/expenses`, `/receipts`, `/budgets` open same month without manual `?ym=`
- [ ] Add expense on overview → open `/expenses` add form → description field pre-filled with last entry
- [ ] Zero edits under `receipts/` directory

---

## Agent 2 — Receipts UX & capture surfaces

**Mission:** Receipt photo → OCR → expense must be **obvious on mobile** and **actionable from overview**, not a hidden `/receipts` page.

### Owns (exclusive write)

```
src/app/(app)/receipts/**
src/app/actions/receipts.ts
src/lib/receiptOcr.ts
src/lib/pdfRasterOcr.ts
src/lib/uploads.ts
src/app/api/receipts/**
src/app/(app)/page.tsx                    # ONLY lines in "Receipts" section + hero CTA block
src/app/(app)/MobileBottomNav.tsx         # Add Receipts tab (replace Coach or use 6-tab scroll)
src/app/(app)/QuickForms.tsx              # Add entry kind "receipt_scan" OR prominent link to capture
```

### Must not touch

- `src/context/**`, `src/components/shared/**` (Agent 1) — **consume** `useHouseholdMonth()` only
- `prisma/schema.prisma` (Agent 3)
- `src/lib/budgetRollup.ts`, `src/lib/merchantRules.ts` (Agent 3)
- `src/app/(app)/insights/**`, `src/app/api/export/**` (Agent 4)

### Deliverables

1. **Mobile nav:** Receipts as primary tab (camera icon label: “Scan”).
2. **Overview receipts card:** Show `ocrStatus`, parsed total, buttons: “Review & post”, “Re-run OCR” linking to `/receipts#id-{id}`.
3. **`ReceiptCaptureSheet`** (new component under `receipts/`): bottom sheet on home for upload without leaving `/`.
4. **Editable parsed lines** before batch post (client state → submit JSON to new action `updateReceiptOcrLinesAction` or pass lines in batch create).
5. **Post-expense redirect:** After posting from receipt, redirect to `/expenses?ym=` with success toast; trigger Agent 1’s entry-defaults event with parsed payee/description.
6. **OCR polling:** Extend `OcrStatusPoller` or add lightweight `GET /api/receipts/[id]/status` for overview widget (new file under `api/receipts/` only).

### Acceptance criteria

- [ ] New user on phone finds “Scan” in bottom nav within 2 taps
- [ ] Upload on overview → OCR status visible on overview without visiting `/receipts`
- [ ] Batch post allows editing line amounts/descriptions before submit
- [ ] No changes to `MonthProvider` implementation (import only)

---

## Agent 3 — Ledger, categories & smart matching

**Mission:** Canonical categories and automatic envelope/tag suggestions so expense data **classifies consistently** across expenses, receipts, imports, and tax.

### Owns (exclusive write)

```
prisma/schema.prisma                    # Category model + Expense.categoryId optional FK only
prisma/migrations/YYYYMMDDHHMMSS_categories/
src/lib/budgetRollup.ts
src/lib/merchantRules.ts
src/app/actions/expenses.ts
src/app/actions/rules.ts
src/app/(app)/expenses/**
src/app/(app)/budgets/**
src/app/(app)/import/**                 # Column mapping + category assignment on import
```

### Must not touch

- `src/context/**` (Agent 1) — read month from URL/cookie as today until Provider merges
- `src/app/(app)/receipts/**`, receipt actions (Agent 2) — expose `suggestCategoryForDescription()` in `merchantRules.ts` for Agent 2 to call later
- `src/app/(app)/page.tsx` except via exported server function consumed by dashboard (no direct page edits)
- `src/app/(app)/insights/**` (Agent 4)

### Deliverables

1. **`Category` model** — `id`, `householdId` (or implicit via settings), `name`, `slug`, optional `budgetPlanId`, `taxCategory` default.
2. **`suggestCategoryForDescription(desc, tags)`** — merchant rules + envelope match; return `{ categoryId, budgetPlanId, tags }`.
3. **Expense forms** — category dropdown; saving sets `budgetPlanId` + `taxCategory` when mapped.
4. **Retroactive suggest UI** on `/expenses` — “Apply rules to N uncategorized rows” (batch server action).
5. **Import mapping** — optional category column → `categoryId`.

### Acceptance criteria

- [x] Single migration tranche; `prisma migrate` passes
- [x] Expense saved with category → insights/budget rollups reflect without manual envelope pick
- [x] Public `suggestCategoryForDescription` exported; no imports from `receipts/` into `expenses/` (one-way)

### Shipped beyond original deliverables (Agent 3 branch)

- Quick add + split + import category pickers; live suggestion API (`/api/categories/suggest`)
- Tax folder sync from categories (bulk + per-save); budget envelope auto-link on plan create/rename
- Missing-envelope panel; spending-by-category summary; editable merchant rules
- CSV export includes `category` / `category_slug`; rollover uses category-aware rollups

---

## Agent 4 — Reports, exports & platform hardening

**Mission:** Unified reporting surface + production-grade platform gaps (exports, Plaid security, offline/push readiness).

### Owns (exclusive write)

```
src/app/(app)/reports/**                # NEW route
src/app/(app)/insights/**
src/app/(app)/flow/**
src/app/(app)/coach/**
src/app/api/export/**
src/lib/plaidClient.ts
src/lib/plaidSync.ts
src/lib/plaidError.ts
src/app/(app)/plaid/**
src/app/actions/plaid.ts
src/lib/env.ts
src/sw.ts
src/instrumentation.ts
ROADMAP.md                                # Check off shipped items only
```

### Must not touch

- `src/context/**` (Agent 1)
- `src/app/(app)/receipts/**` (Agent 2)
- `prisma/schema.prisma` (Agent 3) — if encryption needs columns, add issue for Agent 3 to add `plaidAccessTokenEnc` in agreed migration
- `src/app/(app)/expenses/**` (Agent 3)

### Deliverables

1. **`/reports`** — Month/year toggle (use `?ym=` / `?year=`; consume Agent 1 month helper when available). Charts: spend by category, income vs expense, top merchants (reuse `dashboardData` queries, new `src/lib/reportsData.ts`).
2. **Nav link** — add “Reports” to desktop `layout.tsx` `links` array **only** (coordinate: Agent 4 owns this single array append; Agent 1 does not add nav items).
3. **Export hub** on `/reports` — links to existing `/api/export/*` with current period params.
4. **Plaid token handling** — document + env flag for encryption at rest (implement enc/dec in `plaidClient.ts` if `PLAID_TOKEN_ENCRYPTION_KEY` set; no schema change in v1).
5. **Push readiness spike** — document VAPID steps in `ROADMAP.md`; stub `src/app/api/push/subscribe/route.ts` optional.

### Acceptance criteria

- [ ] `/reports` loads with real data for selected month
- [ ] No file changes under `receipts/`, `expenses/`, `context/`
- [ ] Insights and flow pages link to reports for “full picture”

---

## Cross-agent integration contracts

### Contract A — Month (Agent 1 → all)

```ts
// src/context/hooks.ts (Agent 1 publishes)
export function useHouseholdMonth(): { yearMonth: string; setYearMonth: (ym: string) => void };
export function withYearMonth(path: string, yearMonth: string): string;
```

Agents 2–4: **remove** local `currentYearMonth()` fallbacks in client components; use hook. Server pages may keep `searchParams.ym` until Agent 1’s redirect middleware lands.

### Contract B — Entry defaults (Agent 1 ← Agent 2)

After `createExpenseFromReceiptAction` success, Agent 2 calls:

```ts
window.dispatchEvent(new CustomEvent("household:entry-defaults", { detail: { description, amountCents, budgetPlanId, tags } }));
```

Agent 1’s `EntryDefaultsProvider` subscribes.

### Contract C — Category suggestions (Agent 3 → Agent 2)

```ts
// src/lib/merchantRules.ts (Agent 3 publishes)
export function suggestCategoryForDescription(description: string, tags?: string[]): Suggestion | null;
```

Agent 2: pre-fill `ReceiptPostExpenseForm` budget/category fields when suggestion exists (read-only import; no schema edits).

### Contract D — Reports data (Agent 4 ← Agent 3)

Agent 4 may import `budgetRollup` aggregates; Agent 3 must not change rollup function signatures without updating Agent 4’s PR description.

---

## Testing & verification (each agent)

| Agent | Manual verification |
|-------|----------------------|
| 1 | Change month → add expense on `/` and `/expenses` — same period |
| 2 | Phone: Scan → upload → OCR → post → appears on overview & expenses |
| 3 | Import CSV with category → shows on budgets + reports |
| 4 | `/reports` export downloads match `/expenses` totals |

Run before PR: `npm run build` (or project’s documented build script).

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Two agents edit `layout.tsx` | Agent 1: providers only; Agent 2: mobile nav file only; Agent 4: desktop `links` append |
| Two Prisma migrations | Agent 3 sole schema owner; Agent 4 avoids schema in v1 |
| OCR runtime on Vercel | Already `maxDuration=60` in root layout; Agent 2 keeps processing in `after()` |
| Feature creep | Each PR must cite charter section; reject cross-directory drive-by |

---

## Quick reference — receipt pipeline (already built)

```
ReceiptUploadForm → uploadReceiptAction → saveReceiptUpload
  → prisma.receipt (ocrStatus=pending)
  → after() → processReceiptOcrFile → ReceiptOcrSection UI
  → ReceiptPostExpenseForm / ReceiptBatchExpensesForm → Expense rows
```

**Problem is discovery and propagation, not absence of code.**

---

## Agent kickoff prompts (copy-paste)

### Agent 1

> Implement `docs/ATTACK_PLAN.md` Agent 1 charter only. Branch: `cursor/agent-1-unified-context-3a44`. Do not touch `receipts/`, `prisma/schema`, or `insights/`.

### Agent 2

> Implement Agent 2 charter. Depend on Agent 1’s `useHouseholdMonth` if merged; else use `?ym=` consistently. Branch: `cursor/agent-2-receipts-ux-3a44`.

### Agent 3

> Implement Agent 3 charter. Single Prisma migration for Category. Branch: `cursor/agent-3-ledger-categories-3a44`.

### Agent 4

> Implement Agent 4 charter. New `/reports` route. Branch: `cursor/agent-4-reports-platform-3a44`.

---

*Last updated: 2026-05-20 — audit pass on `main`.*
