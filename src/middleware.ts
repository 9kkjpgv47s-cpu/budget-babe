import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/login", "/register"];

/**
 * App Router serves flight payloads at paths like `/register.rsc`, `/*.prefetch.rsc`,
 * `/*.segment.rsc`. Those must follow the same auth rules as the HTML document path.
 */
function stripNextFlightSuffix(pathname: string): string {
  if (pathname.endsWith(".prefetch.rsc")) {
    return pathname.slice(0, -".prefetch.rsc".length) || "/";
  }
  if (pathname.endsWith(".segment.rsc")) {
    return pathname.slice(0, -".segment.rsc".length) || "/";
  }
  if (pathname.endsWith(".rsc")) {
    return pathname.slice(0, -".rsc".length) || "/";
  }
  return pathname;
}

function isPublicDocumentPath(pathname: string): boolean {
  const docPath = stripNextFlightSuffix(pathname);
  if (docPath === "/~offline" || docPath.startsWith("/~offline/")) return true;
  /** Needed so anonymous navigation/not-found RSC does not 307 to /login. */
  if (docPath === "/_not-found") return true;
  return PUBLIC.some((p) => docPath === p || docPath.startsWith(`${p}/`));
}

/** Map Pages-router style `/_next/data/:buildId/*.json` back to an app path for `?next=`. */
function pagePathFromNextDataUrl(pathname: string): string {
  const m = pathname.match(/^\/_next\/data\/[^/]+\/(.+)\.json$/);
  if (!m) return pathname;
  const slug = m[1];
  return slug === "index" ? "/" : `/${slug}`;
}

function isPublicNextDataRoute(pathname: string): boolean {
  return /\/_next\/data\/[^/]+\/(login|register)\.json$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/sw.js" || pathname.startsWith("/swe-worker")) {
    return NextResponse.next();
  }
  /** Static chunks and image optimizer must bypass auth; `/_next/data/*` is gated like HTML routes. */
  const isNextAsset =
    pathname.startsWith("/_next") && !pathname.startsWith("/_next/data");
  if (
    isNextAsset ||
    pathname.startsWith("/manifest.webmanifest") ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }
  if (isPublicNextDataRoute(pathname)) {
    return NextResponse.next();
  }
  if (isPublicDocumentPath(pathname)) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has("household_budget");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const nextTarget =
      pathname.startsWith("/_next/data/") && pathname.endsWith(".json")
        ? pagePathFromNextDataUrl(pathname)
        : stripNextFlightSuffix(pathname);
    url.searchParams.set("next", nextTarget);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
