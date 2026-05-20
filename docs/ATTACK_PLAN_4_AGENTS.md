# Four-agent attack plan — Household Budget PWA

**Purpose:** Ship a state-of-the-art household financial experience without four parallel agents editing the same files. This document is the **contract** for scope, branches, merge order, and acceptance criteria.

**Repo:** Next.js 15 + Prisma + PostgreSQL household PWA (`/workspace`).

**Last audit:** 2026-05-20 (Cloud Agent pre-flight).

---

## Executive summary

| Area | Status | Gap |
|------|--------|-----|
| Receipt photos + OCR | **Built** (`/receipts`, Tesseract, PDF raster) | **Discoverability & flow** — not in mobile nav, not in Quick Add, overview links drop `?ym=`, OCR totals don’t refresh post-expense forms |
| Cross-field “sync” | **By design: server-only** | No shared client store; `defaultValue` forms go stale; income uses **two sources** (paychecks vs `period.incomeCents`); coach/settings fragmented |
| Bank / import | Plaid + CSV/OFX/QIF | Imports don’t set `budgetPlanId`; merchant rules not retroactive |
| Tax / compliance | Strong workpaper | Mixed controlled/uncontrolled tax form |
| PWA / offline | Serwist shell | No push reminders (roadmap) |

**User-visible symptom:** “I entered something in one place and it doesn’t show up everywhere.”  
**Root cause:** Postgres is the only source of truth; screens only align after `revalidatePath` + navigation. Several **intentional data-model splits** (paychecks vs legacy income, fuzzy budget matching vs explicit links) amplify the feeling of broken sync.

---

## What “state of the art” means here (target bar)

For a **two-person household ledger** (not a full neobank), the bar is:

1. **One mental model of the month** — `?ym=YYYY-MM` preserved on every link; income/spent/left consistent on overview, flow, insights, coach, and trends.
2. **Capture-first UX** — camera receipt and pay stub on the **primary entry surfaces** (home Quick Add + mobile nav), with OCR results flowing into expense fields without a second hunt.
3. **Explicit over implicit** — budget links, tax applicability, and receipt→expense links visible on the same row everywhere.
4. **Feedback loops** — after save: form reset or keyed re-mount; after async OCR: live field update (poller or controlled state).
5. **No silent silos** — document what does *not* sync (debt, net worth, shopping) or add bridges where high value.

---

## Receipt feature — audit (you have it; it’s hard to find)

### Implemented today

| Capability | Location |
|------------|----------|
| Upload image/PDF, `capture="environment"` | `src/app/(app)/receipts/ReceiptUploadForm.tsx` |
| Background OCR (`next/after`) | `src/app/actions/receipts.ts` → `src/lib/receiptOcr.ts` |
| Line items + likely total parsing | `parseReceiptLines`, `parseLikelyTotalCents` in `receiptOcr.ts` |
| Poll until OCR done | `OcrStatusPoller.tsx` (only on `/receipts`) |
| Post single expense / batch lines | `ReceiptPostExpenseForm`, `ReceiptBatchExpensesForm` |
| Move month, re-run OCR, delete | `ReceiptOcrSection.tsx` |

### Why it feels “missing”

1. **Mobile bottom nav** (`MobileBottomNav.tsx`) — Home, Expenses, Bills, Budgets, Coach only. **No Receipts.**
2. **Quick Add** (`QuickForms.tsx`) — expense / bill / budget / paycheck only. **No receipt capture type.**
3. **Overview links** — `href="/receipts"` without `?ym=${yearMonth}` (lines ~294, ~597 in `page.tsx`).
4. **OCR → form** — `ReceiptPostExpenseForm` uses `defaultValue` for amount; OCR finishing later does not update the input until full page refresh.
5. **Overview receipt list** — shows filename/total but no “Post expense” or OCR status; link goes to raw file API, not receipt workflow.

**Agent 2 owns fixing all of the above.**

---

## Cross-app field sync — ranked pain points

| # | Issue | Where | Owner agent |
|---|-------|-------|-------------|
| 1 | Income: paycheck sum vs `period.incomeCents` vs trend chart | `dashboardData.ts`, `page.tsx`, `HomeMobileInsights.tsx` | **Agent 1** |
| 2 | Month context lost on receipt links | `page.tsx`, shared link helper | **Agent 1** |
| 3 | OCR total doesn’t populate expense amount field | `ReceiptPostExpenseForm`, poller | **Agent 2** |
| 4 | Forms don’t reset / re-key after `ok` | All `*Form.tsx`, `*Row.tsx` | **Agent 3** |
| 5 | Tax form: mixed controlled/uncontrolled | `ExpenseTaxApplicabilityForm.tsx` | **Agent 3** |
| 6 | Quick expense: no budget/tags | `QuickForms.tsx` | **Agent 4** (optional budget picker) |
| 7 | Merchant rules not retroactive | `import/page.tsx`, `merchantRules.ts` | **Agent 4** |
| 8 | Household settings split (payday, coach %, notes) | `DashboardPanel`, `CoachSettingsForm` | **Agent 4** |
| 9 | Shopping / debt / net worth isolated | respective pages | **Agent 4** (document or bridge) |

---

## Agent roster (parallel-safe)

### Merge order (mandatory)

```
Agent 1 (foundation)  ──merge to main first──┐
                                            ├──> Agent 4 (integrations) last
Agent 2 (receipts)  ──parallel after 1──────┤
Agent 3 (forms)     ──parallel after 1──────┘
```

Agents **2** and **3** may run in parallel **after Agent 1 is merged**. Agent **4** starts only after **1, 2, and 3** are merged (or rebased onto main).

### Branch naming (required suffix `-7784`)

| Agent | Branch |
|-------|--------|
| 1 | `cursor/agent-1-month-income-foundation-7784` |
| 2 | `cursor/agent-2-receipt-capture-ux-7784` |
| 3 | `cursor/agent-3-form-feedback-sync-7784` |
| 4 | `cursor/agent-4-integrations-polish-7784` |

### Global rules (all agents)

- **Do not** introduce Zustand/Redux/React Query unless Agent 1’s `householdMonth` helper is merged and Agent 4 signs off — prefer server revalidation + small client hooks first.
- **Do not** edit `prisma/schema.prisma` without explicit PM approval (schema changes block all agents).
- **Do not** touch files outside your **OWN** list without a comment in this doc’s changelog.
- Every PR must run: `npm run lint` (if present), `npx prisma validate`, `npm run build`.
- Prefer **new files** over editing the same hot file; when unavoidable, Agent 1 wins `dashboardData.ts` until merged.

---

## Agent 1 — Month & income foundation

**Mission:** One canonical month context and one income number used everywhere.

### OWN (exclusive write)

| Path | Work |
|------|------|
| `src/lib/yearMonth.ts` | Extend: `currentYearMonth`, `parseYearMonthParam`, `yearMonthFromSearchParams` |
| `src/lib/monthLinks.ts` | **NEW** — `hrefWithMonth(path, ym)`, `preserveMonthInHref` |
| `src/lib/dashboardData.ts` | Export `resolveIncomeCents(period, paychecks)`; use everywhere internally |
| `src/lib/householdIncome.ts` | **NEW** — single income resolver + historical series for charts |
| `src/app/(app)/page.tsx` | Fix trend/historical income to use paycheck sums; fix receipt links to `?ym=` |
| `src/app/(app)/HomeMobileInsights.tsx` | Consume unified income series |
| `src/app/(app)/flow/page.tsx` | Align income display if it reads `period.incomeCents` only |
| `src/app/(app)/insights/page.tsx` | Same |

### READ ONLY (do not modify)

- `src/app/(app)/receipts/**`
- `src/app/(app)/**/*Form.tsx`, `*Row.tsx`
- `src/app/actions/receipts.ts`

### Deliverables

1. `resolveIncomeCents()` — if `paychecks.length > 0` → sum; else `period.incomeCents`.
2. All overview → receipt links use `monthLinks.hrefWithMonth('/receipts', yearMonth)`.
3. Mobile/desktop trend “Income” matches stat card income.
4. Unit-less smoke: add paycheck on overview → trend income updates on refresh.

### Acceptance criteria

- [ ] Navigating overview May 2026 → Receipts opens May 2026 (`?ym=2026-05`).
- [ ] Stat card income === trend chart income for same month (with paychecks present).
- [ ] No changes to OCR pipeline or form components.

---

## Agent 2 — Receipt capture & OCR → entry

**Mission:** Receipts feel like a first-class capture path; parsed data prefills expense entry.

### OWN (exclusive write)

| Path | Work |
|------|------|
| `src/app/(app)/receipts/**` | All receipt UI |
| `src/app/actions/receipts.ts` | Upload/post/move OCR actions |
| `src/lib/receiptOcr.ts`, `src/lib/pdfRasterOcr.ts` | Parser tuning only |
| `src/app/(app)/QuickForms.tsx` | Add entry kind `receipt` OR compact “Scan receipt” delegate to upload action |
| `src/app/(app)/MobileBottomNav.tsx` | Add Receipts tab **or** replace Coach in bottom nav (product choice: Receipts > Coach for capture-first) |
| `src/app/(app)/page.tsx` | **Only** the Receipts **section** (~594–625): OCR status badge, link to `?ym=` post flow, “Post expense” deep link |
| `src/components/ReceiptOcrAmountField.tsx` | **NEW** — controlled amount synced from props when OCR completes |

### READ ONLY

- `src/lib/dashboardData.ts` (use Agent 1’s `monthLinks` after merge)
- Generic form reset patterns (Agent 3)

### Deliverables

1. Mobile nav includes **Receipts** (5-tab: consider swapping Coach to overflow menu on mobile).
2. Quick Add: **“Receipt (camera)”** entry type with same upload+OCR path as `/receipts`.
3. `ReceiptPostExpenseForm`: keyed by `receiptId + totalCents + ocrStatus` OR controlled amount updated when poller refreshes.
4. Overview receipt cards: show `OCR: pending|completed`, parsed total, CTA “Finish entry →”.
5. Optional: after OCR, **auto-suggest** description from store name in first parsed line.

### Acceptance criteria

- [ ] User can capture receipt from home without discovering `/receipts` in desktop nav.
- [ ] After OCR completes, amount field shows parsed total without manual re-navigation.
- [ ] Batch “post all lines” still works; no duplicate `receiptId` expenses.
- [ ] Does not modify income aggregation (Agent 1).

---

## Agent 3 — Form feedback & field consistency

**Mission:** After save, UI reflects server state; controlled fields don’t fight each other.

### OWN (exclusive write)

| Path | Work |
|------|------|
| `src/lib/formActionState.ts` | Add `resetKey` or `submittedAt` in success state |
| `src/hooks/useFormResetOnSuccess.ts` | **NEW** — increment key when `state.ok` |
| `src/app/(app)/QuickForms.tsx` | Reset fields on success only (Agent 2 adds receipt kind in parallel — coordinate: Agent 2 owns receipt fields, Agent 3 owns reset wrapper) |
| `src/app/(app)/BillAddForm.tsx`, `BudgetAddForm.tsx` | Keyed reset |
| `src/app/(app)/BillRow.tsx`, `BudgetPlanRow.tsx` | Re-key row after successful update |
| `src/app/(app)/expenses/ExpensesInteractiveList.tsx` | Row re-key after save |
| `src/app/(app)/tax/ExpenseTaxApplicabilityForm.tsx` | Fully controlled taxCategory + taxNote when applicability changes |
| `src/app/(app)/coach/CoachSettingsForm.tsx` | Success message + field sync |
| `src/app/(app)/goals/*Form*.tsx` | Same pattern |
| `src/app/(app)/debt/page.tsx`, `net-worth/page.tsx` | Inline forms re-key |
| `src/app/(app)/shopping/TripForm.tsx`, `TripEditForm.tsx` | Reset trip draft on success |

### READ ONLY

- `src/app/(app)/receipts/ReceiptPostExpenseForm.tsx` — Agent 2 owns controlled OCR amount; Agent 3 may add **generic** `FormSuccessBanner` only via shared component below
| `src/components/FormSuccessBanner.tsx` | **NEW** — shared success/error display (both 2 and 3 may import, only 3 edits file) |

### Coordination with Agent 2

- Agent 3 creates `FormSuccessBanner` + `useFormResetOnSuccess` **first** (day 1).
- Agent 2 imports them in receipt forms; does **not** fork duplicate reset logic.

### Deliverables

1. Quick Add clears inputs after successful add (all entry kinds).
2. Tax applicability change clears/disables category+note appropriately.
3. Edit rows show saved values after action (via `key={savedAt}` from action state).

### Acceptance criteria

- [ ] Add expense via Quick Add → fields empty, new row appears in list below after refresh.
- [ ] Edit bill amount → row shows new amount without stale input.
- [ ] Tax: switching to “Not applicable” clears category in UI and submit payload.
- [ ] No edits to `receiptOcr.ts` or Plaid sync.

---

## Agent 4 — Integrations, nav polish & product gaps

**Mission:** Connect silos, retroactive rules, settings cohesion, roadmap gaps.

**Starts after Agents 1–3 merged to `main`.**

### OWN (exclusive write)

| Path | Work |
|------|------|
| `src/app/(app)/layout.tsx` | Nav grouping, highlight active month context in header |
| `src/app/(app)/import/page.tsx` | “Apply rules to existing expenses” action |
| `src/lib/merchantRules.ts` | `applyRulesToExistingExpenses(periodId)` |
| `src/app/actions/rules.ts` | New server action for retroactive tag apply |
| `src/app/(app)/coach/page.tsx`, `CoachSettingsForm.tsx` | Surface next paycheck + income from Agent 1 helpers (read-only import) |
| `src/app/(app)/DashboardPanel.tsx` | Cross-link to coach settings |
| `src/app/(app)/plaid/PlaidItemRow.tsx` | Post-sync toast: “N expenses imported — assign budgets on Expenses” |
| `src/lib/plaidSync.ts` | Optional: accept default `budgetPlanId` from env/household setting (if no schema change: skip) |
| `ROADMAP.md` | Mark completed integration items |
| `docs/STATE_OF_THE_ART_GAPS.md` | **NEW** — living gap list vs Mint/YNAB/Monarch (features not in scope) |

### READ ONLY

- `src/lib/dashboardData.ts`, `src/lib/monthLinks.ts` (Agent 1)
- Receipt UI (Agent 2)

### Deliverables

1. Merchant rule save → optional “Apply to this month’s existing expenses”.
2. Coach page shows same next paycheck date as overview (read from `HouseholdSettings`).
3. Quick Add expense: optional budget `<select>` (uses existing `budgetPlanId` on create in `monthly.ts`).
4. Document silos: shopping trips, debt, net worth do not affect cash-flow (README or gaps doc).

### Out of scope (do not implement without new epic)

- Prisma schema migrations
- Web push notifications
- Full neobank features (bill pay, credit score, investments)

### Acceptance criteria

- [ ] New merchant rule can update tags on existing rows in current month.
- [ ] Coach and overview show consistent next paycheck date.
- [ ] Gaps doc lists 10+ competitor features with explicit in/out scope.

---

## File ownership matrix (conflict prevention)

| File / area | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|-------------|:-------:|:-------:|:-------:|:-------:|
| `src/lib/dashboardData.ts` | ✅ | ❌ | ❌ | 👁️ |
| `src/lib/monthLinks.ts` | ✅ | 👁️ | 👁️ | 👁️ |
| `src/app/(app)/page.tsx` (income/trends) | ✅ | ❌ | ❌ | ❌ |
| `src/app/(app)/page.tsx` (receipts section) | ❌ | ✅ | ❌ | ❌ |
| `src/app/(app)/receipts/**` | ❌ | ✅ | ❌ | ❌ |
| `src/app/(app)/QuickForms.tsx` | ❌ | ✅ receipt kind | ✅ reset | ✅ budget select |
| `*Form.tsx` / `*Row.tsx` (non-receipt) | ❌ | ❌ | ✅ | ❌ |
| `ReceiptPostExpenseForm.tsx` | ❌ | ✅ | 👁️ banner | ❌ |
| `MobileBottomNav.tsx` | ❌ | ✅ | ❌ | ❌ |
| `merchantRules.ts` / import | ❌ | ❌ | ❌ | ✅ |
| `prisma/schema.prisma` | 🚫 all | 🚫 all | 🚫 all | 🚫 all |

Legend: ✅ write | ❌ do not touch | 👁️ read/import only | 🚫 forbidden

### `QuickForms.tsx` — three-agent touch protocol

This is the **only** intentional shared file:

1. Agent 1 merges first (no QuickForms changes).
2. Agent 2 adds `receipt` entry kind + file input (lines ~64–78 region).
3. Agent 3 adds `useFormResetOnSuccess` wrapper around entire form (single hook at top).
4. Agent 4 adds optional budget `<select>` inside expense branch only.

**Rebase order if conflicts:** 1 → 2 → 3 → 4.

---

## State-of-the-art gap research (backlog beyond 4 agents)

### Already strong

- Household two-user auth, month model, PWA offline shell
- Receipt OCR with line parsing + batch post
- Tax workpaper with IRC guidance, audit trail, export
- Plaid sync, CSV/OFX/QIF, split expenses, coach, goals

### Missing vs leading apps (prioritized)

| Priority | Feature | Notes |
|----------|---------|-------|
| P0 | Unified month + income (this plan) | Agents 1–3 |
| P0 | Receipt on primary capture surfaces | Agent 2 |
| P1 | Real-time balance / account aggregation | Plaid exists; net worth manual only |
| P1 | Recurring transaction detection | Not present |
| P1 | Budget alerts / envelope overspend push | Not present |
| P2 | Split transactions UI on manual entry | Import split only |
| P2 | Multi-currency | Single currency implied |
| P2 | Rules engine (IF merchant THEN category) | Merchant rules partial |
| P3 | Investment accounts | Out of household scope |
| P3 | Bill pay / ACH | Out of scope |

### UX polish backlog (post-agent-4)

- Profile edit (name/email)
- Receipt thumbnail grid on overview
- Pay stub OCR progress indicator on Quick Add paycheck
- Shopping trip → “Create expense from trip total”
- Goals progress from net worth snapshot delta

---

## Verification checklist (full app audit)

Run after all four agents merge:

```bash
npm ci
npx prisma validate
npm run build
```

Manual flows:

1. **Month stickiness:** Overview `?ym=2026-04` → Receipts → still April.
2. **Paycheck income:** Add paycheck → overview income + flow + insights match.
3. **Receipt capture:** Quick Add → Receipt → photo → OCR → amount prefilled → post expense → appears on overview + expenses with `receiptId`.
4. **Form reset:** Quick Add expense → submit → fields cleared.
5. **Tax:** Toggle applicability → category/note behavior correct.
6. **Merchant rule:** Add rule → apply retroactive → tags appear on old expenses.
7. **Plaid sync:** Sync → expenses list → bulk budget assign still works.

---

## Agent kickoff prompts (copy-paste)

### Agent 1

> Read `docs/ATTACK_PLAN_4_AGENTS.md` Agent 1 section. Branch `cursor/agent-1-month-income-foundation-7784`. Implement month link helper and unified income for dashboard trends. Do not touch receipts or forms.

### Agent 2

> Read `docs/ATTACK_PLAN_4_AGENTS.md` Agent 2 section. Wait for Agent 1 merge. Branch `cursor/agent-2-receipt-capture-ux-7784`. Make receipt capture visible on mobile nav and Quick Add; fix OCR→amount field sync. Own `receipts/**` only.

### Agent 3

> Read `docs/ATTACK_PLAN_4_AGENTS.md` Agent 3 section. Wait for Agent 1 merge. Branch `cursor/agent-3-form-feedback-sync-7784`. Add `useFormResetOnSuccess` and fix tax form controlled state. Do not touch `receiptOcr.ts`.

### Agent 4

> Read `docs/ATTACK_PLAN_4_AGENTS.md` Agent 4 section. Wait for Agents 1–3 merge. Branch `cursor/agent-4-integrations-polish-7784`. Retroactive merchant rules, coach/overview settings cohesion, Quick Add budget select, gaps doc.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-20 | Initial audit + four-agent scope contract |
