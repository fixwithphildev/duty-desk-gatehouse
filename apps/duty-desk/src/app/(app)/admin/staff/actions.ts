"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUsercode, hashUsercode } from "@/lib/usercode";
import { DD_ADMIN_ROLES, assignableRolesFor, canManageAccount, type DDRole } from "@/lib/types";

export async function createStaffAction(input: {
  username: string;
  displayName: string;
  role: DDRole;
}): Promise<{ username: string; usercode: string }> {
  const session = await requireRole(DD_ADMIN_ROLES);
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  if (!username || !displayName) throw new Error("Username and display name are required.");
  if (!assignableRolesFor(session.role).includes(input.role)) {
    throw new Error("You aren't permitted to create an account with that role.");
  }

  const { data: existing } = await supabaseAdmin
    .from("staff_accounts")
    .select("id")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  if (existing) throw new Error("That username is already taken.");

  const usercode = generateUsercode();
  const usercodeHash = await hashUsercode(usercode);

  const { error } = await supabaseAdmin.from("staff_accounts").insert({
    username,
    display_name: displayName,
    role: input.role,
    usercode_hash: usercodeHash,
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
  return { username, usercode };
}

async function getTargetRole(id: string): Promise<DDRole> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("role").eq("id", id).maybeSingle();
  if (!data) throw new Error("Account not found.");
  return data.role as DDRole;
}

export async function setAccountDisabledAction(id: string, disabled: boolean) {
  const session = await requireRole(DD_ADMIN_ROLES);
  if (id === session.staffId) throw new Error("You can’t switch off your own account.");
  const targetRole = await getTargetRole(id);
  if (!canManageAccount(session.role, targetRole)) throw new Error("You aren't permitted to manage that account.");

  const { error } = await supabaseAdmin.from("staff_accounts").update({ disabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}

export async function resetUsercodeAction(id: string): Promise<{ usercode: string }> {
  const session = await requireRole(DD_ADMIN_ROLES);
  if (id === session.staffId) throw new Error("Change your own usercode from My account.");
  const targetRole = await getTargetRole(id);
  if (!canManageAccount(session.role, targetRole)) throw new Error("You aren't permitted to manage that account.");

  const usercode = generateUsercode();
  const usercodeHash = await hashUsercode(usercode);
  const { error } = await supabaseAdmin
    .from("staff_accounts")
    .update({ usercode_hash: usercodeHash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
  return { usercode };
}

export async function unlockAccountAction(id: string) {
  const session = await requireRole(DD_ADMIN_ROLES);
  const targetRole = await getTargetRole(id);
  if (!canManageAccount(session.role, targetRole)) throw new Error("You aren't permitted to manage that account.");

  const { error } = await supabaseAdmin.from("staff_accounts").update({ failed_attempts: 0, locked_until: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}
