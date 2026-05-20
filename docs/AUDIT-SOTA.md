# State-of-the-art audit — Household Budget PWA

**Audit date:** 2026-05-20  
**Scope:** Read-only assessment before four-agent remediation sprint.  
**Rubric:** 1 = far below market, 3 = solid household tool, 5 = best-in-class consumer fintech.

| Category | Score | Summary |
|----------|-------|---------|
| Money capture (manual) | 3 | Strong server actions; quick add under-powered |
| Receipt / document capture | 4 | OCR pipeline exists; discoverability & post-flow weak |
| Categorization & envelopes | 3 | Budget match text + tags; no AI, uneven auto-link |
| Bank connectivity | 2 | Plaid optional, manual sync, tokens not encrypted |
| Cash-flow & reporting | 3 | Overview, flow, insights, exports — no unified feed |
| Tax & compliance | 4 | Unusually strong for a household PWA |
| Security & privacy | 2 | Session auth OK; Plaid secrets at rest gap |
| Mobile / PWA | 3 | Offline shell; nav hides key “photos first” path |
| Household collaboration | 2 | Two-user cap, shared ledger, no roles/permissions |
| **Overall** | **3.0** | Production-shaped niche app; UX cohesion is main gap |

---

## 1. Money capture (manual entry)

**Strengths**

- Unified quick entry kinds: expense, bill, budget line, paycheck (`QuickForms.tsx` + `unifiedQuickEntryAction`)
- Full expense editor on `/expenses` with bulk tags/budget
- Import paths: CSV, OFX, QIF, split wizard (`/import`)

**Gaps vs SOTA**

- Quick expense omits date, payee, tags, budget — forces second edit (YNAB/Copilot capture everything in one sheet)
- Duplicate forms for bills and budgets (`BillAddForm`, `BillRow`, etc.)
- No recurring transaction templates
- Legacy `MonthlyPeriod.incomeCents` displayed but not editable

**Evidence:** `src/app/(app)/QuickForms.tsx`, `src/app/actions/monthly.ts`, `ROADMAP.md`

---

## 2. Receipt & document capture

**Strengths**

- Full pipeline: upload → background OCR (`next/after`) → Tesseract + PDF text + raster fallback
- Parsed line items + total extraction (`src/lib/receiptOcr.ts`)
- Single and batch expense posting with `receiptId` linkage
- Pay stub OCR on paycheck quick add (`paystubOcr.ts`)

**Gaps vs SOTA**

- **Discoverability:** Receipts not in mobile bottom nav; users report feature “missing”
- **Date propagation:** `spentAt` set to `new Date()` on post, not receipt date (`receipts.ts`)
- **Batch posting:** No shared budget on line batch; lines without amounts skipped silently
- **Storage:** Without Vercel Blob, receipts ephemeral on serverless
- **No** email-forward ingest, **no** LLM line-item repair for messy OCR

**Evidence:** `src/app/(app)/receipts/`, `src/app/(app)/MobileBottomNav.tsx`, `src/app/actions/receipts.ts`

---

## 3. Categorization & budget envelopes

**Strengths**

- Envelope model with rollover and copy-from-prior-month
- Merchant rules → tags (`/import` rules section)
- Budget rollup by category substring match (`budgetRollup.ts`)

**Gaps vs SOTA**

- Tags do not auto-select budget envelope
- Three “category” concepts (budget match text, expense tags, tax folder) confuse users
- No ML merchant normalization; Plaid categories not mapped

**Evidence:** `src/lib/merchantRules.ts`, `src/lib/budgetRollup.ts`, `prisma/schema.prisma`

---

## 4. Bank connectivity

**Strengths**

- Plaid Link + transaction sync → expenses with dedupe (`plaidSync.ts`)

**Gaps vs SOTA**

- Manual sync only; no webhooks/cron
- `PlaidItem.accessToken` plaintext in DB (schema comment acknowledges)
- No balance sync to net worth / debt accounts
- No account-level mapping to budget lines

**Evidence:** `prisma/schema.prisma` (`PlaidItem`), `src/app/(app)/plaid/`

---

## 5. Cash-flow & reporting

**Strengths**

- Monthly overview, `/flow` timeline, `/insights` breakdowns
- CSV exports for expenses, bills, budgets, tax

**Gaps vs SOTA**

- No single “all activity” ledger view across paychecks/bills/expenses
- No custom reports or charts export
- Shopping trips not integrated into spend totals

**Evidence:** `src/app/(app)/flow/page.tsx`, `src/app/(app)/insights/page.tsx`

---

## 6. Tax & compliance

**Strengths**

- Three-way applicability, IRC guidance viewer, audit notes, review trail, bulk assign, CSV export
- Receipt link surfaced in tax UI when `receiptId` present

**Gaps vs SOTA**

- No mileage/home office calculators
- Documentation path relies on user discipline (appropriate for preparer handoff)

**Evidence:** `src/app/(app)/tax/`, `src/lib/taxCodeGuidance.ts`

---

## 7. Security & privacy

**Strengths**

- `iron-session`, bcrypt passwords, auth middleware
- Production env validation (`instrumentation.ts`)

**Gaps vs SOTA**

- Plaid tokens not encrypted at rest
- No 2FA, device sessions, or mutation audit log for all financial writes
- Two-user registration cap is product choice, not security control

**Evidence:** `src/lib/session.ts`, `prisma/schema.prisma`, `src/lib/env.ts`

---

## 8. Mobile / PWA

**Strengths**

- Serwist service worker, offline fallback page, manifest
- Mobile-first overview cards

**Gaps vs SOTA**

- Bottom nav omits Receipts (core product principle: “photos first” in `ROADMAP.md`)
- OCR polling stops ~90s; long PDFs may look stuck
- No web push (roadmap item)

**Evidence:** `src/sw.ts`, `src/app/(app)/MobileBottomNav.tsx`, `ROADMAP.md`

---

## 9. Prioritized remediation map

| Priority | Item | Agent |
|----------|------|-------|
| P0 | Field propagation & shared entry contracts | Alpha |
| P0 | Receipt discoverability + OCR post UX | Beta |
| P0 | Unified expense fields on all forms | Gamma |
| P0 | This audit + roadmap sync | Delta |
| P1 | Plaid token encryption + scheduled sync | Delta |
| P1 | Web push bill reminders | Future |
| P2 | Unified activity feed | Future |
| P2 | Shopping → expense posting | Future |

See **[AGENTS-ATTACK-PLAN.md](./AGENTS-ATTACK-PLAN.md)** for parallel execution boundaries.
