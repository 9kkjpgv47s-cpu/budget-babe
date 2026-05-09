import { PrismaClient } from "@prisma/client";
import { normalizePostgresUrlForServerless } from "@/lib/neonDatabaseUrl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** When set, use Neon-safe pooled URL for runtime queries (PgBouncer). */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || raw.startsWith("file:")) return undefined;
  return normalizePostgresUrlForServerless(raw);
}

const datasourceUrl = runtimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
