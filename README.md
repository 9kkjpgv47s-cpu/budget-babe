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

### Production

Set a long random `SESSION_PASSWORD` (32+ characters) in the environment. The app validates this at startup in production via `src/instrumentation.ts`.

Receipt files are stored under `data/receipts/` (not in git) and served only to signed-in users via `/api/receipts/[id]`.

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
