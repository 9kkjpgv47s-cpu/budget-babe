# Household Budget (PWA)

Private money app for **two people in one household**: monthly income and spending, bills due before the next paycheck, budget lines, receipt uploads, grocery trip memory with suggested lists, and savings goals with spending adjustments.

See **[ROADMAP.md](./ROADMAP.md)** for shipped vs planned features.

## Stack

- Next.js 15 (App Router), React 19, Tailwind CSS 4
- Prisma 6 + **PostgreSQL** (local Docker/Neon/etc.; required for **Vercel** — SQLite file DBs do not work on serverless)
- Sessions with `iron-session` (cookie encrypted)
- Optional **[Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** for receipt / pay stub binaries when `BLOB_READ_WRITE_TOKEN` is set (otherwise files use `data/receipts` and `data/paystubs` on local disk only)

## Setup

```bash
npm install
cp .env.example .env
# Set DATABASE_URL to a Postgres URL (see below)
npx prisma migrate dev
npm run dev
```

**Database:** create an empty Postgres database and point `DATABASE_URL` at it (connection string with `sslmode=require` for hosted providers). Example with Docker:

```bash
docker run --name budget-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=household_budget -p 5432:5432 -d postgres:16
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/household_budget"
```

Open [http://localhost:3000](http://localhost:3000), register the first account, then the second (registration is blocked after two users). Use **Household settings → Month notes** on the overview for shared reminders for the selected calendar month.

On **Shopping**, the trip form pre-fills a **usual basket** from items that repeat across recent trips. Use **Same as last trip** or **Add suggested picks** to avoid retyping; edit rows before saving. **Duplicate as new trip** clones a saved trip in the list; **Start from last trip** (button or `/shopping?from=last`) opens the log form with your most recent trip’s lines as a new draft.

**Paycheck coach** (`/coach`): set saving **5%–40%** of each paycheck and **paychecks per month**; get grocery and free-spending caps, a **two-week bill plan** after your next pay date, and short recommendations toward ending each check with extra.

**Savings goals** (`/goals`): edit title, target, and deadline; remove spending adjustments; track progress toward each target.

### Net worth

- **`/net-worth`**: manual **asset** and **liability** accounts, live totals, **record snapshot** history (no bank sync).

### Plaid (optional bank sync)

- **`/plaid`**: connect an institution with **Plaid Link** (Transactions product), then **Sync transactions** to import posted rows as expenses (deduped by Plaid transaction id). Each household user links under their own login; **Disconnect** revokes the item at Plaid when possible and removes the local row.
- Environment: `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` (`sandbox` | `development` | `production`). See `.env.example`. Treat stored access tokens as secrets (encrypt at rest in production).

### Envelope rollover

- Each **budget line** has **rolled-in** cents plus the monthly limit. **Available** = rolled in + limit − matched spending.
- Overview and **`/budgets`**: **Apply suggested rollovers** sets rolled-in from the **same-named** line’s unused balance last month. **Copy budget lines** can run that step in one submit via checkbox.

### Import, rules, exports, insights, debt

- **`/import`**: paste **CSV** (optional 0-based column overrides), **OFX/QFX** (STMTTRN), or **QIF** (`!Type:Bank`). Same dedupe and merchant rules as CSV. **Split wizard** creates multiple lines with one shared split group id.
- **Export**: while signed in, use **Download expenses CSV** / **Download bills CSV** / **Download budgets CSV** on the Import page, or `GET /api/export/expenses?ym=YYYY-MM`, `GET /api/export/bills?ym=YYYY-MM`, `GET /api/export/budgets?ym=YYYY-MM`, and **`GET /api/export/tax?year=YYYY`** (qualifying tax-folder lines only).
- **`/tax`**: calendar-year **workpaper** for expenses marked **Applicable** or **Applicable with proper documentation**; each row uses a three-way **applicability** status, an IRC-oriented **guidance** pick list, **View tax guidance** modal (with disclaimer), preparer **folder**, **audit notes**, and **mark reviewed**. **Applicable with proper documentation** requires a short audit note when no receipt is linked. **`GET /api/export/tax?year=`** CSV includes applicability and guidance title.
- **`/expenses`**: edit/delete; **search**; **bulk** tags and budget link; **tax** block per row (folder, notes, reviewed).
- **`/flow`**: chronological view of income anchor, next paycheck, bills, and expenses.
- **`/insights`**: spending by budget line (with bar strips), uncategorized total, and **often-repeated** merchants (possible subscriptions).
- **`/debt`**: manual debt accounts with **in-place edit** (balance, minimum, APR) or remove.
- Overview **bills**: **copy from last month** (due dates +1 month; skips exact duplicates), **edit**, **delete**, and mark paid. Dedicated **`/bills?ym=`** page with month navigation.
- **`/budgets?ym=`**: month navigation, **apply rolled-in**, **copy lines** (optional checkbox to apply rolled-in after copy), edit/delete lines, quick add.

### Production / Vercel

Deploy from this repo on [Vercel](https://vercel.com). Builds use **[`scripts/vercel-build.mjs`](scripts/vercel-build.mjs)** — wired from **`npm run build`** (the usual Next.js build command) and from **`vercel.json`** **`buildCommand`**. It runs **`prisma migrate deploy`** only when **`DATABASE_URL`** is set and not a sqlite **`file:`** URL; then **`prisma generate`** and **`next build`**.

**Build Command override:** In **Project → Settings → Build & Development**, leave **Build Command** empty so **[`vercel.json`](vercel.json)** is used, or set it explicitly to **`npm run build`**. Turn **off** any stale dashboard override such as **`npm run vercel-build`** left over from an older **`package.json`** — logs stuck showing **`prisma migrate deploy && prisma generate && next build`** almost always mean the dashboard is still forcing **`npm run vercel-build`** against outdated scripts instead of using **`npm run build`**.

**Deploy before database:** you can ship a **successful build** without **`DATABASE_URL`** (migrations are skipped and a note is logged). The deployed app will **not work end-to-end** (login and DB-backed pages need Postgres) until you set **`DATABASE_URL`** for **Preview** and **Production** and **redeploy** so migrations apply. Alternatively, point **`DATABASE_URL`** at a new Postgres instance and run **`npx prisma migrate deploy`** locally once, then deploy.

1. **Database:** Provision **Postgres** (any host: Vercel Postgres, Supabase, Neon, RDS, …). Set **`DATABASE_URL`** on the project for **Preview** and **Production** (Preview-only deploys do not read Production-only secrets). If migrations fail with your provider’s pooled URL, use their non-pooled “direct” URL for migrations per provider docs.
2. **Sessions:** Set **`SESSION_PASSWORD`** (32+ characters). Production startup validates this (`src/instrumentation.ts`).
3. **File uploads:** Add **[Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** and set **`BLOB_READ_WRITE_TOKEN`**. On Vercel without Blob, receipt/pay stub files would be written to ephemeral function disk and **will not persist** across deployments.
4. **Serverless timeouts:** Root layout sets **`maxDuration = 60`** so receipt/pay stub OCR has enough time on Pro-tier-style limits (hobby limits may still cap lower — upgrade or simplify OCR if needed).

Receipt and pay stub rows store either a **public Blob HTTPS URL** or a **local basename** under `data/` (dev only).

### Production (non-Vercel)

Set a long random **`SESSION_PASSWORD`** (32+ characters). Use Postgres and, if the host has no durable disk, configure **`BLOB_READ_WRITE_TOKEN`** (or another object store) the same way as on Vercel.

### Receipt OCR

**Recommended:** capture the receipt with your phone camera or pick a photo from your gallery (JPEG/PNG/WebP, etc.). That is the fastest and most reliable input.

After each upload, the server runs **OCR in the background** (`next/after`):

- **Photos**: [Tesseract.js](https://github.com/naptha/tesseract.js) extracts text. TIFF inputs are converted with Sharp first.
- **PDFs** (optional): [pdf-parse](https://www.npmjs.com/package/pdf-parse) reads **embedded** text when present; otherwise the server **renders the first five pages** and runs Tesseract (requires the native [`canvas`](https://www.npmjs.com/package/canvas) package — on Linux you typically need `build-essential`, `libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev`, and `librsvg2-dev` for `npm install` to compile it).

Parsed **line items** (description + trailing price) and a **likely total** (from keywords like `TOTAL`) are stored on the receipt row when the parser finds them. The Receipts page polls until processing finishes. You can **post an expense** from a receipt (uses OCR total if amount is blank), or **post all parsed lines** as linked split expenses when amounts exist.

First production deploy may download Tesseract language data on demand (~few MB for `eng`).

## PWA

The app exposes a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) (`src/app/manifest.ts`). Install from the browser “Add to Home screen” on supported devices.

**Offline shell (production builds):** After `next build` / deploy, Serwist registers **`/sw.js`**, precaches the app shell (including the static **`/~offline`** page), and uses Workbox-style runtime caching for navigations and assets. If a document request fails while offline, you should see the offline page instead of the browser’s generic error. Service worker integration is **disabled during `next dev`** to avoid conflicting with hot reload; test with `npm run build && npm start`. The generated `public/sw.js` is gitignored and produced at build time.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build via **`vercel-build.mjs`**: conditional migrate, **`prisma generate`**, **`next build`** |
| `npm run build:next` | **`prisma generate`** + **`next build`** only (no migrate; handy locally) |
| `npm run vercel-build` | Same as **`npm run build`** (alias) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create or apply Prisma migrations (development) |
