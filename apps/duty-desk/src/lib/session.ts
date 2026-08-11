import { SignJWT, jwtVerify } from "jose";
import type { DDRole } from "./types";

export const SESSION_COOKIE = "dd_session";

// Sliding session lengths, per blueprint 4.2: shared devices (the front
// desk / duty PC) time out quickly; a staff member's own phone can stay
// signed in much longer.
export const SHARED_DEVICE_TTL_SECONDS = 20 * 60; // 20 minutes
export const PERSONAL_DEVICE_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export interface SessionPayload {
  staffId: string;
  username: string;
  displayName: string;
  role: DDRole;
  persistent: boolean;
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
  return new SignJWT({ ...payload })
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
