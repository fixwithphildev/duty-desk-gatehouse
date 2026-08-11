import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase";
import { verifyUsercode } from "./usercode";
import { SESSION_COOKIE, signSession, verifySession, sessionTtlSeconds, type SessionPayload } from "./session";
import type { GHRole, StaffAccount } from "./types";
import { isPathAllowed } from "./nav";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

async function logAttempt(params: {
  staffId: string | null;
  username: string;
  success: boolean;
  reason: string;
}) {
  const h = headers();
  await supabaseAdmin.from("login_events").insert({
    staff_id: params.staffId,
    username_attempted: params.username,
    success: params.success,
    reason: params.reason,
    ip: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null,
    user_agent: h.get("user-agent") ?? null,
  });
}

export async function attemptLogin(
  username: string,
  usercode: string,
  persistent: boolean
): Promise<LoginResult> {
  const usernameTrimmed = username.trim();
  if (!usernameTrimmed || !usercode) {
    return { ok: false, error: "Enter your username and usercode." };
  }

  const { data: account } = await supabaseAdmin
    .from("staff_accounts")
    .select("*")
    .eq("username_lower", usernameTrimmed.toLowerCase())
    .maybeSingle();

  if (!account) {
    await logAttempt({ staffId: null, username: usernameTrimmed, success: false, reason: "unknown_username" });
    return { ok: false, error: "Invalid username or usercode." };
  }

  if (account.disabled) {
    await logAttempt({ staffId: account.id, username: usernameTrimmed, success: false, reason: "disabled" });
    return { ok: false, error: "This account has been disabled. Contact your administrator." };
  }

  if (account.locked_until && new Date(account.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
    await logAttempt({ staffId: account.id, username: usernameTrimmed, success: false, reason: "locked" });
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}, or ask your admin to reset your usercode.`,
    };
  }

  const valid = await verifyUsercode(usercode, account.usercode_hash);

  if (!valid) {
    const nextAttempts = account.failed_attempts + 1;
    const lockedOut = nextAttempts >= LOCKOUT_THRESHOLD;
    await supabaseAdmin
      .from("staff_accounts")
      .update({
        failed_attempts: lockedOut ? 0 : nextAttempts,
        locked_until: lockedOut ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null,
      })
      .eq("id", account.id);
    await logAttempt({ staffId: account.id, username: usernameTrimmed, success: false, reason: "bad_usercode" });
    if (lockedOut) {
      return {
        ok: false,
        error: `Too many failed attempts. This account is now locked for ${LOCKOUT_MINUTES} minutes.`,
      };
    }
    const remaining = LOCKOUT_THRESHOLD - nextAttempts;
    return {
      ok: false,
      error: `Invalid username or usercode. ${remaining} attempt${remaining === 1 ? "" : "s"} left before lockout.`,
    };
  }

  await supabaseAdmin
    .from("staff_accounts")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", account.id);
  await logAttempt({ staffId: account.id, username: usernameTrimmed, success: true, reason: "ok" });

  const payload: SessionPayload = {
    staffId: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role as GHRole,
    persistent,
  };
  const token = await signSession(payload);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds(persistent),
  });

  return { ok: true };
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Call at the top of any authenticated Server Component / Server Action.
// Redirects to /login if there's no valid session, and re-checks the
// account hasn't been disabled since the token was issued.
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data: account } = await supabaseAdmin
    .from("staff_accounts")
    .select("disabled")
    .eq("id", session.staffId)
    .maybeSingle();

  if (!account || account.disabled) {
    cookies().delete(SESSION_COOKIE);
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowed: GHRole[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}

// Enforces the per-role page visibility from the blueprint 4.3 permission
// matrix (e.g. only Security Supervisor/Super Admin can reach /admin, even
// by typing the URL). Pass the page's own literal route.
export async function requirePageAccess(pathname: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isPathAllowed(session.role, pathname)) {
    redirect("/dashboard");
  }
  return session;
}

export async function signOut(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}

export async function getStaffDirectory(): Promise<StaffAccount[]> {
  const { data } = await supabaseAdmin
    .from("staff_accounts")
    .select("id, username, display_name, role, disabled, must_change_code, failed_attempts, locked_until, created_at")
    .order("created_at", { ascending: false });
  return (data as StaffAccount[]) ?? [];
}
