/**
 * Transaction-mode poolers (Neon `-pooler` hosts, Supabase pooler, etc.) work best with Prisma when
 * `pgbouncer=true` is set so prepared statements are not used against PgBouncer.
 * Safe no-op for direct/instance Postgres URLs.
 */
export function normalizePostgresUrlForServerless(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("file:")) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();

    const pooledLikeHost =
      host.includes("pooler") || host.includes("pool.supabase");

    if (!pooledLikeHost) return trimmed;

    if (!u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    if (host.includes("neon.tech") && !u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}
