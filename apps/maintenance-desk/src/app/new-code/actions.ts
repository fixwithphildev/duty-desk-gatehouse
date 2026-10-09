"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hashUsercode, verifyUsercode } from "@/lib/usercode";

export interface NewCodeState {
  error?: string;
}

// First sign-in (or after a reset): replace the one-time code with one only this person knows.
export async function setOwnUsercodeAction(_prev: NewCodeState, formData: FormData): Promise<NewCodeState> {
  const session = await requireSession({ allowCodeChange: true });
  const code = String(formData.get("newCode") ?? "");
  const confirm = String(formData.get("confirmCode") ?? "");

  const { data: account } = await supabaseAdmin.from("staff_accounts").select("usercode_hash, must_change_code").eq("id", session.staffId).maybeSingle();
  if (!account) redirect("/login");
  if (!account.must_change_code) redirect("/dashboard");

  if (code.length < 6) return { error: "Your usercode must be at least 6 characters." };
  if (code !== confirm) return { error: "The two usercodes don’t match. Type them again." };
  if (code.toLowerCase() === session.username.toLowerCase()) return { error: "Don’t use your username as your usercode." };
  if (/^(.)\1+$/.test(code) || "0123456789".includes(code) || "abcdefghijklmnopqrstuvwxyz".includes(code.toLowerCase())) {
    return { error: "That usercode is too easy to guess. Mix letters and numbers." };
  }
  if (await verifyUsercode(code, account.usercode_hash)) return { error: "Choose a different usercode from the one-time code you were given." };

  const { error } = await supabaseAdmin
    .from("staff_accounts")
    .update({ usercode_hash: await hashUsercode(code), must_change_code: false, updated_at: new Date().toISOString() })
    .eq("id", session.staffId);
  if (error) return { error: error.message };
  redirect("/dashboard");
}
