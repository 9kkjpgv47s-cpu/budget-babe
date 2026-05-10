import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import ws from "ws";
import { normalizePostgresUrlForServerless } from "@/lib/neonDatabaseUrl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.toLowerCase().includes("neon.tech");
  } catch {
    return false;
  }
}

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
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter, log: [...logs] });
  }

  return new PrismaClient({
    datasources: { db: { url: connectionString } },
    log: [...logs],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
