# Financial App — Audit & 4-Agent Attack Plan

**Repo:** Household Budget PWA (`/workspace`)  
**Goal:** State-of-the-art household finance UX where **one entry propagates everywhere**, receipt photos **parse into ledger rows**, and four agents work **at the same time** without merge collisions.

---

## Parallel execution vs merge order (read this first)

| Concept | What it means |
|---------|----------------|
| **Agent work** | **All 4 start together** — each checks out `main`, creates their branch, codes immediately. No agent waits for another agent’s PR to merge. |
| **Merge to `main`** | **Sequential only when integrating** — merge Agent 1 → 2 → 3 → 4 so `receipts.ts` and `entryDefaults.ts` conflicts resolve in a fixed order. That is **not** “run Agent 2 after Agent 1 finishes coding.” |
| **Shared contract** | `src/lib/entryDefaults.ts` is **already on `main`** (stub). Agents 2–3 **import** it on day one; only **Agent 1** may change its implementation. |

```text
TIME ──────────────────────────────────────────────────────────────►

  Agent 1  ████████████████████  (branch: agent-1-entry-defaults)
  Agent 2  ████████████████████  (branch: agent-2-receipt-ux)
  Agent 3  ████████████████████  (branch: agent-3-categorization)
  Agent 4  ████████████████████  (branch: agent-4-polish)
           ↑ all start same day, different files

  Merge    ──► PR1 ──► PR2 ──► PR3 ──► PR4   (integration only)
```

**Launch all four Cloud Agents in one batch** with the kickoff prompts at the bottom. Use file ownership so nobody edits the same path.

---

## Executive summary (audit)

The app is a **production-shaped Next.js 15 PWA** (not a stub): auth, overview, expenses, bills, budgets, Plaid, import, tax, goals, coach, debt, net worth, shopping, and **full receipt OCR** (Tesseract + PDF) are implemented. Data truth lives in **PostgreSQL + Prisma**; UI updates via **Server Actions + `revalidatePath`** — there is **no** global client store (no Zustand, React Query, or Context).

### Why receipt photos feel “missing”

Receipt capture **exists and works** at `/receipts`, but discoverability is weak on mobile:

| Finding | Impact |
|--------|--------|
| Receipt OCR is **complete** (`src/lib/receiptOcr.ts`, `src/app/actions/receipts.ts`, `ReceiptOcrSection.tsx`) | Feature is built, not absent |
| Overview links to receipts (`page.tsx` ~294, ~596) | Easy to miss below the fold on long home scroll |
| **Mobile bottom nav** has Home / Expenses / Bills / Budgets / Coach only — **no Receipts** | Primary mobile path never surfaces camera upload |
| Quick add on home has **no receipt upload** | Users expect “photo → parsed expense” on the same form as amount/description |
| Pay stub OCR runs **inline** on paycheck submit; no persisted OCR status | Inconsistent mental model vs receipts |

### Why “one field doesn’t populate throughout”

There is **no shared entry profile** across forms. Each surface re-fetches from DB after submit, but **defaults are not coordinated**:

| Gap | Where | What breaks |
|-----|-------|-------------|
| Quick expense: no budget/tags | `QuickForms.tsx` | Posted expenses stay uncategorized until `/expenses` edit |
| Batch receipt lines: no budget picker | `ReceiptBatchExpensesForm.tsx` | Split lines miss envelope linkage |
| Move receipt month ≠ move expenses | `moveReceiptToMonthAction` | Receipt and expenses diverge by month |
| Post expense uses **page** `yearMonth`, not receipt’s period | `ReceiptPostExpenseForm.tsx` | Wrong `?ym=` → wrong month ledger |
| OCR total won’t override manual upload total | `processReceiptOcrFile` | User typo blocks parser correction |
| Plaid sync: bare expenses | `plaidSync.ts` | No budget/tags unless merchant rules hit |
| Shopping trips ≠ expenses | `shopping/*` | Grocery spend double-entry or missing from budgets |
| Merchant rules apply inconsistently | import vs receipt batch vs quick add | Same payee, different tags/budget |

These are **coordination bugs**, not missing database fields. Fixing them does not require a monolithic state library first — it requires **shared server helpers + consistent form defaults**.

---

## State-of-the-art gap analysis (research)

Compared to leading apps (YNAB, Monarch, Copilot, Rocket Money) and 2025–2026 expectations:

### Table stakes — **shipped**

- Multi-user household ledger, monthly periods, envelope budgets with rollover
- Bank link (Plaid) + file import (CSV/OFX/QIF)
- Receipt image/PDF OCR → single or batch expenses
- Tax workpaper with applicability + export
- PWA offline shell, CSV exports

### High-impact gaps — **not shipped** (prioritized for agents)

1. **Unified entry propagation** — last-used budget, tags, payee, month flow into every create path
2. **Receipt-first mobile UX** — camera in nav + overview quick capture
3. **Smart categorization pipeline** — merchant rules + budget suggestion on Plaid, import, OCR batch, quick add
4. **Shopping ↔ ledger bridge** — optional “post trip total to expenses”
5. **Receipt/expense month integrity** — move/post always respect receipt period
6. **Optimistic / inline feedback** — reduce “submit and wait” feel (can be incremental)
7. **Pay stub parity** — same async OCR + review UI as receipts
8. **Push bill reminders** — on roadmap, out of scope for this wave unless Agent 4 has spare capacity

### Nice-to-have (defer)

- Multi-currency, investments, shared splits with non-household users
- ML merchant categorization beyond rules
- Full double-entry accounting

---

## 4-agent parallel plan (non-overlapping)

### Rules of engagement (all agents)

1. **Start in parallel:** branch off **`main` today** — `git checkout main && git pull && git checkout -b cursor/agent-<N>-<slug>-e9cc`
2. **Branch naming:** `cursor/agent-<N>-<slug>-e9cc`
3. **Do not edit files outside your ownership list** without PR comment: `// AGENT-N-EXCEPTION: reason`
4. **Shared contract** (`src/lib/entryDefaults.ts`): **stub on `main`** — Agent 1 **implements/extends**; Agents 2–3 **import only** (never rename exports)
5. **Merge order (integration only):** PR1 → PR2 → PR3 → PR4; rebase open PRs onto `main` after each merge — **not** a requirement to delay starting work
6. **No schema migrations** except Agent 1 (one migration max in PR1)
7. Run `npm run lint` before push

---

## Agent 1 — Data propagation & entry contracts

**Theme:** *One entry, consistent defaults everywhere.*

### Owns (exclusive write)

```
src/lib/entryDefaults.ts          # EXTEND stub (do not break exports Agents 2–3 import)
src/app/actions/monthly.ts        # unifiedQuickEntryAction, addExpenseCore
src/app/actions/expenses.ts       # create/update, bulk tags/budget
src/app/actions/receipts.ts       # ONLY: moveReceipt*, post expense month resolution
src/app/(app)/QuickForms.tsx
src/lib/merchantRules.ts          # centralize rule application API
src/lib/formActionState.ts        # if extending success payloads with defaults
```

### Does NOT touch

- `src/app/(app)/receipts/*` UI components (Agent 2)
- `src/lib/receiptOcr.ts`, `src/lib/paystubOcr.ts` (Agent 2)
- `src/lib/plaidSync.ts`, `shopping/*` (Agent 3)
- `tax/*`, `insights/*`, `flow/*`, `MobileBottomNav.tsx` (Agents 2/4)

### Tasks

1. Extend `entryDefaults.ts` (stub already exports `getLastExpenseDefaults`, `applyMerchantRulesToDraft`, `resolvePostingYearMonth`)
2. Extend **QuickForms** expense path: budget `<select>`, optional tags, payee; pre-fill from `entryDefaults`
3. **moveReceiptToMonthAction**: optionally move linked `Expense` rows (checkbox default on: “Move linked expenses too”)
4. **Receipt post actions** (server only): use `resolvePostingYearMonth`; fix batch create to accept optional `budgetPlanId`
5. Apply `applyMerchantRulesToDraft` in `addExpenseCore`, receipt batch create, and document hook for Agent 3 Plaid

### Acceptance criteria

- [ ] Add expense from overview with budget + tags; appears categorized on `/expenses` and budget rollup without edit
- [ ] Post receipt expense while viewing wrong `?ym=` still lands in receipt’s month
- [ ] Move receipt with “move expenses” updates both receipt and expenses
- [ ] No changes to OCR parsing logic or receipt UI layout

### Estimated touch surface: ~12 files, medium invasiveness

---

## Agent 2 — Receipt capture UX & OCR surfacing

**Theme:** *Photos first — visible, fast, parsed into the ledger.*

### Owns (exclusive write)

```
src/app/(app)/receipts/*
src/app/(app)/MobileBottomNav.tsx
src/app/(app)/page.tsx              # ONLY: receipt CTA blocks / mobile strip (not QuickForms)
src/app/actions/receipts.ts         # ONLY: upload, OCR reprocess, delete (NOT move/post month — Agent 1)
src/lib/receiptOcr.ts
src/lib/pdfRasterOcr.ts
src/lib/uploads.ts
src/app/api/receipts/*
```

### Does NOT touch

- `QuickForms.tsx`, `entryDefaults.ts`, `monthly.ts` (Agent 1)
- `plaidSync.ts`, `shopping/*`, `budgetRollup.ts` (Agent 3)
- `tax/*` (Agent 4)

### Tasks

1. **Mobile nav:** add “Receipts” (replace “Coach” in tab bar or use 6-tab scroll row — design choice in PR)
2. **Overview hero CTA:** sticky or above-fold “Scan receipt” → `/receipts?ym={current}` with camera hint
3. **Inline upload on overview** (thin wrapper): `ReceiptUploadForm` embedded OR deep-link with `?capture=1` auto-focus file input
4. OCR UX: when `completed`, **pre-fill** post forms from `parsedLines` / `totalCents`; show “Suggested total” if user total differs
5. **OcrStatusPoller:** toast or banner on overview when pending receipts exist (read count via small server component)
6. Allow “Use OCR total” button to overwrite manual total (calls Agent 1’s action if exists, or local action in receipts.ts upload path — coordinate in PR comment)

### Acceptance criteria

- [ ] On phone, bottom nav reaches receipt upload in ≤2 taps
- [ ] Upload → OCR → post expense without visiting desktop header
- [ ] User sees parsed line items before typing amounts manually
- [ ] Does not implement budget/tags on quick add (Agent 1)

### Parallel notes

- **No wait for Agent 1.** Post/month logic lives in Agent 1’s half of `receipts.ts`; you own upload/OCR UI only.
- Optional: import `resolvePostingYearMonth` in UI to **display** resolved month (read-only); do not change post actions.

### Estimated touch surface: ~15 files, medium invasiveness

---

## Agent 3 — Categorization, Plaid, shopping ↔ ledger

**Theme:** *Money in the right envelope without manual rework.*

### Owns (exclusive write)

```
src/lib/plaidSync.ts
src/lib/bulkExpenseImport.ts
src/lib/csvImport.ts
src/app/actions/import.ts
src/app/actions/plaid.ts
src/app/(app)/plaid/*
src/app/(app)/import/*
src/app/(app)/shopping/*
src/app/actions/shopping.ts
src/lib/budgetRollup.ts            # optional: suggestBudgetForDescription()
src/app/(app)/expenses/ExpensesInteractiveList.tsx   # ONLY: suggestion chips UI
```

### Does NOT touch

- `receipts/*`, `receiptOcr.ts`, `QuickForms.tsx` (Agents 1–2)
- `tax/*`, `coach/*`, PWA (Agent 4)

### Tasks

1. Import `applyMerchantRulesToDraft` from `entryDefaults.ts` in Plaid sync + CSV/OFX bulk paths
2. **Budget suggestion:** `suggestBudgetForDescription(description, plans)` using plan `category` match text + tags
3. Plaid sync: set tags + `budgetPlanId` when rule/suggestion confident; flag “needs review” in expense list
4. **Shopping → expense:** “Add trip to ledger” on saved trip — one expense for trip total OR per-line (user choice)
5. Import page: show preview of applied rules before commit

### Acceptance criteria

- [ ] Plaid-imported row has tags/budget when merchant rule exists
- [ ] Shopping trip can create matching expense(s) in same month
- [ ] Import preview shows rule-applied tags
- [ ] No receipt UI changes

### Parallel notes

- Import `applyMerchantRulesToDraft` from `entryDefaults.ts` on **`main` stub** — works day one; gets smarter when PR1 merges.

### Estimated touch surface: ~18 files, medium-high invasiveness

---

## Agent 4 — Tax, insights, polish & production hardening

**Theme:** *Trust, clarity, and mobile completeness.*

### Owns (exclusive write)

```
src/app/(app)/tax/*
src/app/(app)/insights/*
src/app/(app)/flow/*
src/app/(app)/coach/*
src/app/(app)/goals/*
src/app/(app)/debt/*
src/app/(app)/net-worth/*
src/app/(app)/HomeMobileInsights.tsx
src/app/(app)/DashboardPanel.tsx
src/app/(app)/layout.tsx            # ONLY: desktop nav ordering/labels, NOT MobileBottomNav
src/app/(app)/error.tsx
src/sw.ts
src/app/~offline/*
ROADMAP.md                          # check off completed agent work
docs/STATE_OF_THE_ART_CHECKLIST.md  # NEW optional scoring sheet
```

### Does NOT touch

- `entryDefaults.ts`, `QuickForms.tsx`, `receipts/*`, `plaidSync.ts`, `shopping/*` (Agents 1–3)

### Tasks

1. Tax: receipt-linked expenses show thumbnail + “open receipt”; warn when documentation required but no `receiptId`
2. Insights: drill-down link to filtered `/expenses?payee=` or tag
3. Flow: align chronology with paycheck panel data
4. Coach/goals: copy clarity pass (no logic changes unless bugfix)
5. PWA: verify offline page mentions receipts path; manifest shortcuts if low effort
6. Maintain `STATE_OF_THE_ART_CHECKLIST.md` with scored categories (0–3) post-merge

### Acceptance criteria

- [ ] Tax row without receipt shows actionable link to upload
- [ ] Insights merchant row links to expense filter
- [ ] No regressions to Agents 1–3 files

### Parallel notes

- **Fully independent** — start immediately; update checklist scores after all PRs merge.

### Estimated touch surface: ~25 files, lower invasiveness (mostly UI copy + links)

---

## File ownership matrix (quick reference)

| Path | Agent |
|------|-------|
| `src/lib/entryDefaults.ts` | **1** (creates) |
| `QuickForms.tsx` | **1** |
| `receipts/*` UI | **2** |
| `MobileBottomNav.tsx` | **2** |
| `receiptOcr.ts`, `uploads.ts` | **2** |
| `receipts.ts` actions | **1** (move/post/month) + **2** (upload/OCR) — see split below |
| `plaidSync.ts`, `import/*`, `shopping/*` | **3** |
| `tax/*`, `insights/*`, `flow/*`, `coach/*` | **4** |

### `src/app/actions/receipts.ts` split (avoid collision)

| Function area | Owner |
|---------------|-------|
| `uploadReceipt*`, `reprocessOcr*`, `deleteReceipt*` | Agent 2 |
| `createExpenseFromReceipt*`, `moveReceipt*`, `createExpensesFromReceiptLines*` | Agent 1 |
| Both may **add** new exports; neither **renames** existing exports without sync comment |

---

## Verification playbook (post all merges)

```bash
npm run lint
npm run build:next   # or full build if DATABASE_URL available
```

Manual E2E:

1. Register/login → overview `?ym=2026-05`
2. Quick add expense with budget → check `/budgets` remaining
3. Mobile width: bottom nav → Receipts → capture/upload → wait OCR → post line → expense on overview
4. Move receipt to prior month with “move expenses” → confirm expense month matches
5. Plaid sync (sandbox) → expense has tag/budget if rule exists
6. Shopping trip → “Add to ledger” → expense appears
7. Tax applicable + no receipt → warning + link

---

## Agent kickoff prompts (copy-paste)

### Agent 1

> **Start now in parallel.** `docs/AGENT_ATTACK_PLAN.md` Agent 1. Branch `cursor/agent-1-entry-defaults-e9cc` off `main`. **Extend** `src/lib/entryDefaults.ts` (do not remove exports). QuickForms + receipt post/move in `receipts.ts`. Do not edit `receipts/*` UI or `MobileBottomNav.tsx`.

### Agent 2

> **Start now in parallel.** `docs/AGENT_ATTACK_PLAN.md` Agent 2. Branch `cursor/agent-2-receipt-ux-e9cc` off `main`. Mobile nav + overview receipt CTA + OCR prefill. Do **not** wait for Agent 1. Do not edit `entryDefaults.ts` or QuickForms.

### Agent 3

> **Start now in parallel.** `docs/AGENT_ATTACK_PLAN.md` Agent 3. Branch `cursor/agent-3-categorization-e9cc` off `main`. Import `applyMerchantRulesToDraft` from `entryDefaults.ts` in Plaid/import/shopping. Do not touch receipt UI.

### Agent 4

> **Start now in parallel.** `docs/AGENT_ATTACK_PLAN.md` Agent 4. Branch `cursor/agent-4-polish-e9cc` off `main`. Tax receipt links, insights drill-downs, checklist. Fully independent file set.

---

## How to launch four Cloud Agents at once

In Cursor, start **four separate Cloud Agent tasks in the same batch** (or four tabs), each with one kickoff prompt above. Point all four at repo `budget-babe` / branch off **`main`** after this plan PR merges (or merge plan + stub first, then launch).

| Agent | Branch | Blocks another agent? |
|-------|--------|------------------------|
| 1 | `cursor/agent-1-entry-defaults-e9cc` | No |
| 2 | `cursor/agent-2-receipt-ux-e9cc` | No |
| 3 | `cursor/agent-3-categorization-e9cc` | No |
| 4 | `cursor/agent-4-polish-e9cc` | No |

---

*Last updated: 2026-05-20 — parallel execution clarified*
