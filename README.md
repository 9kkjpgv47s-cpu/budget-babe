# Household Budget (PWA)

Private money app for **two people in one household**: monthly income and spending, bills due before the next paycheck, budget lines, receipt uploads, grocery trip memory with suggested lists, and savings goals with spending adjustments.

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

Open [http://localhost:3000](http://localhost:3000), register the first account, then the second (registration is blocked after two users).

On **Shopping**, the trip form pre-fills a **usual basket** from items that repeat across recent trips. Use **Same as last trip** or **Add suggested picks** to avoid retyping; edit rows before saving.

### Production

Set a long random `SESSION_PASSWORD` (32+ characters) in the environment. The app validates this at startup in production via `src/instrumentation.ts`.

Receipt files are stored under `data/receipts/` (not in git) and served only to signed-in users via `/api/receipts/[id]`.

### Receipt OCR

After each upload, the server runs **OCR in the background** (`next/after`):

- **Photos** (JPEG, PNG, WebP, GIF, BMP): [Tesseract.js](https://github.com/naptha/tesseract.js) extracts text. TIFF inputs are converted with Sharp first.
- **PDFs**: [pdf-parse](https://www.npmjs.com/package/pdf-parse) reads **embedded** text only. Image-only (scanned) PDFs cannot be OCR’d with this stack; upload a **camera photo** instead for Tesseract.

Parsed **line items** (description + trailing price) and a **likely total** (from keywords like `TOTAL`) are stored on the receipt row when the parser finds them. The Receipts page polls until processing finishes.

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
