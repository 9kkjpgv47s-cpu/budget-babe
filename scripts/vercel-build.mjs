#!/usr/bin/env node
/**
 * Vercel production build: run migrations only when a hosted Postgres DATABASE_URL exists.
 * Skipping migrate allows green builds before Postgres is configured; add DATABASE_URL and redeploy to apply migrations.
 */

import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
}

const db = process.env.DATABASE_URL ?? "";

console.log("[vercel-build] Neon HTTP safety guard…");
run("node scripts/check-neon-http-safety.mjs");

if (db.trim() && !db.startsWith("file:")) {
  console.log("[vercel-build] Running prisma migrate deploy…");
  run("npx prisma migrate deploy");
} else {
  console.log(
    "[vercel-build] Migrations skipped until DATABASE_URL is set (missing or sqlite file: URL); redeploy after adding Postgres.",
  );
}

console.log("[vercel-build] prisma generate…");
run("npx prisma generate");

console.log("[vercel-build] next build…");
run("npx next build");
