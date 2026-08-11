"use server";

import { requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hashUsercode, verifyUsercode } from "@/lib/usercode";

export async function changeOwnUsercodeAction(input: { currentCode: string; newCode: string; confirmCode: string }) {
  const session = await requireSession();

  if (input.newCode.length < 6) throw new Error("New usercode must be at least 6 characters.");
  if (input.newCode !== input.confirmCode) throw new Error("New usercode entries don't match.");

  const { data: account } = await supabaseAdmin.from("staff_accounts").select("usercode_hash").eq("id", session.staffId).maybeSingle();
  if (!account) throw new Error("Account not found.");

  const valid = await verifyUsercode(input.currentCode, account.usercode_hash);
  if (!valid) throw new Error("Current usercode is incorrect.");

  const newHash = await hashUsercode(input.newCode);
  const { error } = await supabaseAdmin
    .from("staff_accounts")
    .update({ usercode_hash: newHash, must_change_code: false, updated_at: new Date().toISOString() })
    .eq("id", session.staffId);
  if (error) throw new Error(error.message);
}
