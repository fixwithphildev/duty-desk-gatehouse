#!/usr/bin/env node
// One-time script to create the first Super Admin account on this platform.
// Run with: npm run seed:super-admin
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from apps/duty-desk/.env.local.

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

function loadEnvLocal() {
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateUsercode(length = 8) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) code += CHARSET[bytes[i] % CHARSET.length];
  return code;
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    console.error("Create apps/duty-desk/.env.local from .env.example first (see SETUP.md).");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n=== Gatehouse — create the first Super Admin account ===\n");
  const username = (await rl.question("Username (e.g. p.atabo): ")).trim();
  const displayName = (await rl.question("Display name (e.g. Philip Atabo): ")).trim();
  rl.close();

  if (!username || !displayName) {
    console.error("Username and display name are required.");
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from("staff_accounts")
    .select("id")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  if (existing) {
    console.error(`Username "${username}" already exists.`);
    process.exit(1);
  }

  const usercode = generateUsercode();
  const usercodeHash = await bcrypt.hash(usercode, 12);

  const { error } = await supabase.from("staff_accounts").insert({
    username,
    display_name: displayName,
    role: "super_admin",
    usercode_hash: usercodeHash,
  });
  if (error) {
    console.error("Failed to create account:", error.message);
    process.exit(1);
  }

  console.log("\nSuper Admin account created.");
  console.log(`  Username: ${username}`);
  console.log(`  Usercode: ${usercode}`);
  console.log("\nWrite this usercode down now — it is not stored anywhere in plain text and won't be shown again.");
  console.log("You can change it after your first login from My Account, or reset it later from the Staff Accounts admin page.\n");
}

main();
