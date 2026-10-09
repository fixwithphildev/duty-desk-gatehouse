import { SignJWT, jwtVerify } from "jose";
import type { MDRole } from "./types";

export const SESSION_COOKIE = "md_session";

// Sliding session lengths, matching the pattern used by Duty Desk and
// Gatehouse: shared devices (a workshop PC) time out quickly; a
// technician's own phone can stay signed in much longer.
export const SHARED_DEVICE_TTL_SECONDS = 20 * 60; // 20 minutes
export const PERSONAL_DEVICE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export interface SessionPayload {
  staffId: string;
  username: string;
  displayName: string;
  role: MDRole;
  persistent: boolean;
  // When the person actually signed in (ms). Stays the same when the session
  // is renewed while they're working; older sessions only have iat.
  signedInAt?: number;
  iat?: number; // when the token was last signed, in seconds (set by jose)
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short. Set it in your environment.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const ttl = payload.persistent ? PERSONAL_DEVICE_TTL_SECONDS : SHARED_DEVICE_TTL_SECONDS;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { iat, exp, ...rest } = payload as SessionPayload & { exp?: number };
  return new SignJWT({ ...rest, signedInAt: rest.signedInAt ?? Date.now() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionTtlSeconds(persistent: boolean): number {
  return persistent ? PERSONAL_DEVICE_TTL_SECONDS : SHARED_DEVICE_TTL_SECONDS;
}

// When the person signed in, in ms (sessions from before renewal only have iat).
export function sessionSignedInAt(session: SessionPayload): number {
  return session.signedInAt ?? (session.iat ?? 0) * 1000;
}
