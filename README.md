# Household Budget (PWA)

Private money app for **two people in one household**: monthly income and spending, bills due before the next paycheck, budget lines, receipt uploads, grocery trip memory with suggested lists, and savings goals with spending adjustments.

See **[ROADMAP.md](./ROADMAP.md)** for shipped vs planned features.

## Stack

- Next.js 15 (App Router), React 19, Tailwind CSS 4
- Prisma 6 + SQLite (`prisma/dev.db` by default)
- Sessions with `iron-session` (cookie encrypted)

## Setup

```bash
npm install
cp .env.example .env   # optional: set SESSION_PASSWORD for production
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register the first account, then the second (registration is blocked after two users). Use **Household settings → Month notes** on the overview for shared reminders for the selected calendar month.

On **Shopping**, the trip form pre-fills a **usual basket** from items that repeat across recent trips. Use **Same as last trip** or **Add suggested picks** to avoid retyping; edit rows before saving.

**Paycheck coach** (`/coach`): set saving **5%–40%** of each paycheck and **paychecks per month**; get grocery and free-spending caps, a **two-week bill plan** after your next pay date, and short recommendations toward ending each check with extra.

**Savings goals** (`/goals`): edit title, target, and deadline; remove spending adjustments; track progress toward each target.

### Net worth

- **`/net-worth`**: manual **asset** and **liability** accounts, live totals, **record snapshot** history (no bank sync).

### Envelope rollover

- Each **budget line** has **rolled-in** cents plus the monthly limit. **Available** = rolled in + limit − matched spending.
- Overview and **`/budgets`**: **Apply suggested rollovers** sets rolled-in from the **same-named** line’s unused balance last month. **Copy budget lines** can run that step in one submit via checkbox.

### Import, rules, exports, insights, debt

- **`/import`**: paste **CSV** (optional 0-based column overrides), **OFX/QFX** (STMTTRN), or **QIF** (`!Type:Bank`). Same dedupe and merchant rules as CSV. **Split wizard** creates multiple lines with one shared split group id.
- **Export**: while signed in, use **Download expenses CSV** / **Download bills CSV** / **Download budgets CSV** on the Import page, or `GET /api/export/expenses?ym=YYYY-MM`, `GET /api/export/bills?ym=YYYY-MM`, and `GET /api/export/budgets?ym=YYYY-MM`.
- **`/expenses`**: edit/delete; **search**; **bulk** append/replace tags and set/clear budget link on selected rows (checkboxes).
- **`/flow`**: chronological view of income anchor, next paycheck, bills, and expenses.
- **`/insights`**: spending by budget line (with bar strips), uncategorized total, and **often-repeated** merchants (possible subscriptions).
- **`/debt`**: manual debt accounts with **in-place edit** (balance, minimum, APR) or remove.
- Overview **bills**: **copy from last month** (due dates +1 month; skips exact duplicates), **edit**, **delete**, and mark paid. Dedicated **`/bills?ym=`** page with month navigation.
- **`/budgets?ym=`**: month navigation, **apply rolled-in**, **copy lines** (optional checkbox to apply rolled-in after copy), edit/delete lines, quick add.

### Production

Set a long random `SESSION_PASSWORD` (32+ characters) in the environment. The app validates this at startup in production via `src/instrumentation.ts`.

Receipt files are stored under `data/receipts/` (not in git) and served only to signed-in users via `/api/receipts/[id]`. You can **move a receipt** to another month from the receipt list (month picker).

### Receipt OCR

**Recommended:** capture the receipt with your phone camera or pick a photo from your gallery (JPEG/PNG/WebP, etc.). That is the fastest and most reliable input.

After each upload, the server runs **OCR in the background** (`next/after`):

- **Photos**: [Tesseract.js](https://github.com/naptha/tesseract.js) extracts text. TIFF inputs are converted with Sharp first.
- **PDFs** (optional): [pdf-parse](https://www.npmjs.com/package/pdf-parse) reads **embedded** text when present; otherwise the server **renders the first five pages** and runs Tesseract (requires the native [`canvas`](https://www.npmjs.com/package/canvas) package — on Linux you typically need `build-essential`, `libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev`, and `librsvg2-dev` for `npm install` to compile it).

Parsed **line items** (description + trailing price) and a **likely total** (from keywords like `TOTAL`) are stored on the receipt row when the parser finds them. The Receipts page polls until processing finishes. You can **post an expense** from a receipt (uses OCR total if amount is blank), or **post all parsed lines** as linked split expenses when amounts exist.

First production deploy may download Tesseract language data on demand (~few MB for `eng`).

## PWA

The app exposes a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) (`src/app/manifest.ts`). Install from the browser “Add to Home screen” on supported devices.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create or apply Prisma migrations (development) |
