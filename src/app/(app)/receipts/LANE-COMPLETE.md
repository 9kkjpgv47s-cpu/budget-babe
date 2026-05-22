# Agent Beta lane — complete

Receipt capture, OCR, discoverability, and posting to spending. All items below are implemented on branch `cursor/agent-beta-receipts-3044`.

## Discoverability

- Mobile bottom nav: **Receipts** (with OCR processing / ready-to-post badges)
- Home: **Scan a receipt** (`ReceiptQuickCapture`), overview strip with status
- `/expenses`: compact scan + **linked spending** strip back to receipt scans
- Desktop nav: Receipts near top

## Capture & OCR

- Camera/gallery upload, drag-drop, preview, client image compression
- PDF + raster OCR (`receiptOcr.ts`, `pdfRasterOcr.ts`)
- Blob storage warning on Vercel
- Month navigation, search, filter tabs (All / Ready / Reading / Posted / Failed)
- OCR poller with long timeout + status banner
- Bulk re-run OCR on failed/skipped month receipts

## Posting to spending

- Quick post (one tap), post all ready, auto-post optional on upload
- Single expense + batch line items with **editable lines** before post
- Payee, description, date, budget suggestion, merchant rules → tags
- Duplicate total warning (7 days)
- CSV export: `GET /api/receipts/export?ym=YYYY-MM`

## APIs (Beta-owned)

- `GET /api/receipts/[id]` — file view
- `GET /api/receipts/[id]/status` — OCR/post readiness JSON
- `GET /api/receipts/ocr-pending` — nav badge counts
- `GET /api/receipts/export` — month metadata CSV

## Polish (phase 9)

- Scan FAB links to `#upload`; hash scroll + file focus on receipts page
- EU totals in `parseLikelyTotalCents` (e.g. `TOTAL: 42,18`)
- Auto-post guardrails: min OCR confidence, max $5k, skip duplicate amount (7 days)
- Status API: `autoPostSafe` + `autoPostBlockedReason`
- `test:receipt-parse` runs in `vercel-build` before Next build

## Polish (phase 8)

- Mobile **Scan** FAB on Home, Expenses, Receipts
- Receipt tips collapsible; stricter upload file types
- EU-style amounts in line parser (`12,34`)
- Line editor: add/remove rows; batch post redirects to Spending
- Export CSV includes `merchant_guess`
- `npm run test:receipt-parse` smoke script

## Polish (phase 6)

- Mobile **More** menu (Coach, Budgets, Import, Tax, Flow, Insights)
- Month stats strip on `/receipts`
- Delete confirmation when expenses are linked
- HEIC/HEIF → JPEG normalization on upload
- Post-success navigation to `/expenses` for quick/batch/auto post
- OCR poller respects tab visibility

## Explicitly out of lane (other agents)

- Unified QuickForms fields → **Gamma** (`ExpensesInteractiveList`, `QuickForms`)
- `src/lib/entry/*` propagation → **Alpha**
- Plaid encryption, PWA `sw.ts`, ROADMAP audit → **Delta**
