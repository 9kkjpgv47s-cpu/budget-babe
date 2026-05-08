import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";

const revision = (() => {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  const out = r.stdout?.trim();
  return out || randomUUID();
})();

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pdf-parse", "sharp", "canvas"],
};

export default withSerwist(nextConfig);
