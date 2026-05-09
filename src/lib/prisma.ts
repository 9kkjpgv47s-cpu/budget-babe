import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { normalizePostgresUrlForServerless } from "@/lib/neonDatabaseUrl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.toLowerCase().includes("neon.tech");
  } catch {
    return false;
  }
}

/**
 * Neon on Vercel: prefer HTTP fetch driver — avoids WebSocket + `ws` native issues in serverless bundles.
 * @see https://www.prisma.io/docs/orm/overview/databases/neon
 */
function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL?.trim();
  const logs =
    process.env.NODE_ENV === "development"
      ? (["error", "warn"] as const)
      : (["error"] as const);

  if (!raw || raw.startsWith("file:")) {
    return new PrismaClient({ log: [...logs] });
  }

  const connectionString = normalizePostgresUrlForServerless(raw);

  if (isNeonHost(connectionString)) {
    const adapter = new PrismaNeonHTTP(connectionString, {
      arrayMode: false,
      fullResults: false,
    });
    return new PrismaClient({ adapter, log: [...logs] });
  }

  return new PrismaClient({
    datasources: { db: { url: connectionString } },
    log: [...logs],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
