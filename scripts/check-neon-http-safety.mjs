#!/usr/bin/env node
/**
 * Guardrail: Prisma Neon HTTP adapter does not support transaction APIs.
 * Fail CI/build if disallowed patterns reappear in server code.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src/app", "src/lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

const RULES = [
  {
    id: "prisma-transaction",
    message: "Prisma transactions are not supported in Neon HTTP mode.",
    regex: /\$transaction\s*\(/g,
  },
  {
    id: "prisma-upsert",
    message:
      "Prisma upsert may use transaction paths that fail in Neon HTTP mode.",
    regex: /\.upsert\s*\(/g,
  },
];

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineAt(source, lineNo) {
  const lines = source.split("\n");
  return (lines[lineNo - 1] ?? "").trim();
}

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
}

async function main() {
  const files = [];
  for (const rel of TARGET_DIRS) {
    const abs = path.join(ROOT, rel);
    await walk(abs, files);
  }

  const violations = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(source)) !== null) {
        const line = lineNumberAt(source, match.index);
        violations.push({
          filePath: path.relative(ROOT, filePath),
          line,
          text: lineAt(source, line),
          ruleId: rule.id,
          message: rule.message,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log("[neon-http-guard] OK: no disallowed Prisma patterns found.");
    return;
  }

  console.error(
    `[neon-http-guard] Found ${violations.length} disallowed Prisma usage(s):`,
  );
  for (const v of violations) {
    console.error(
      `  - ${v.filePath}:${v.line} [${v.ruleId}] ${v.message}\n    ${v.text}`,
    );
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("[neon-http-guard] Failed to run:", error);
  process.exit(1);
});
