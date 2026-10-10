import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

// Fast edge-level gate: redirect to /login if there's no valid session
// token. The authoritative check (has the account since been disabled?)
// happens in requireSession() on the server, since that needs a DB call.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/login" || pathname.startsWith("/_next") || pathname.startsWith("/api/health");
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!isPublic && !session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // The tab icons load before anyone signs in, so they skip the sign-in check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
