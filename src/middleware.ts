import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/login", "/register"];

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
  if (pathname === "/~offline" || pathname.startsWith("/~offline/")) {
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
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has("household_budget");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const nextTarget =
      pathname.startsWith("/_next/data/") && pathname.endsWith(".json")
        ? pagePathFromNextDataUrl(pathname)
        : pathname;
    url.searchParams.set("next", nextTarget);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
