import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Where requireSession() sends a session that has ended (account switched
// off, or its usercode reset since signing in): clears the sign-in cookie,
// which a page can't do, and goes to the sign-in page.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
