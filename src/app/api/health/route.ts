import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public sanity check after deploy: DB reachable + session secret configured.
 * Does not expose secrets. Use GET /api/health on your Vercel URL.
 */
export async function GET() {
  const pw = process.env.SESSION_PASSWORD?.trim();
  const sessionConfigured = typeof pw === "string" && pw.length >= 32;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "connected",
      sessionConfigured,
    });
  } catch (err) {
    console.error("[api/health] database check failed:", err);
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        sessionConfigured,
      },
      { status: 503 },
    );
  }
}
