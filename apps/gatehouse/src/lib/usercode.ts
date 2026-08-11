import "server-only";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

// Unambiguous charset: no 0/O or 1/I, so a code read aloud or handwritten
// on a card can't be misread.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USERCODE_LENGTH = 8;

export function generateUsercode(): string {
  let code = "";
  const bytes = crypto.randomBytes(USERCODE_LENGTH);
  for (let i = 0; i < USERCODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export async function hashUsercode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

export async function verifyUsercode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
