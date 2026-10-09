import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionTtlSeconds, signSession, verifySession } from "@/lib/session";

// Renews the sign-in while someone is using the app, so a shared computer
// signs out after 20 minutes of no use rather than 20 minutes after signing
// in. The original sign-in time is kept (a code reset still ends the session).
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return new NextResponse(null, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds(session.persistent),
  });
  return res;
}
