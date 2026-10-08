"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUsercode, hashUsercode } from "@/lib/usercode";
import { MD_STAFF_VIEW_ROLES, canManageAccount, creatableRolesFor, isUnit, type MDRole } from "@/lib/types";

export async function createStaffAction(input: {
  username: string;
  displayName: string;
  role: MDRole;
  unit: string;
}): Promise<{ username: string; usercode: string }> {
  // Only the Admin creates accounts.
  const session = await requireRole(["super_admin"]);
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  if (!username || !displayName) throw new Error("Username and full name are required.");
  if (!/^[a-z0-9][a-z0-9._-]{2,}$/i.test(username)) throw new Error("Usernames use letters, numbers and dots, like kola.adebayo.");
  if (!creatableRolesFor(session.role).includes(input.role)) throw new Error("You aren't permitted to create an account with that role.");
  if (input.role === "maintenance_technician" && !isUnit(input.unit)) throw new Error("Choose the technician’s unit.");

  const { data: existing } = await supabaseAdmin.from("staff_accounts").select("id").eq("username_lower", username.toLowerCase()).maybeSingle();
  if (existing) throw new Error("That username is already taken.");

  const usercode = generateUsercode();
  const { error } = await supabaseAdmin.from("staff_accounts").insert({
    username,
    display_name: displayName,
    role: input.role,
    unit: input.role === "maintenance_technician" ? input.unit : null,
    usercode_hash: await hashUsercode(usercode),
    // The code we generate is one-time: they choose their own at first sign-in.
    must_change_code: true,
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
  return { username, usercode };
}

async function getTargetRole(id: string): Promise<MDRole> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("role").eq("id", id).maybeSingle();
  if (!data) throw new Error("Account not found.");
  return data.role as MDRole;
}

async function guard(id: string) {
  const session = await requireRole(MD_STAFF_VIEW_ROLES);
  if (!canManageAccount(session.role, await getTargetRole(id))) throw new Error("You aren't permitted to manage that account.");
  return session;
}

export async function setAccountDisabledAction(id: string, disabled: boolean) {
  const session = await guard(id);
  if (id === session.staffId) throw new Error("You can’t switch off your own account.");
  const { error } = await supabaseAdmin.from("staff_accounts").update({ disabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}

export async function resetUsercodeAction(id: string): Promise<{ usercode: string }> {
  const session = await guard(id);
  if (id === session.staffId) throw new Error("Change your own usercode from My account.");
  const usercode = generateUsercode();
  const { error } = await supabaseAdmin
    .from("staff_accounts")
    .update({ usercode_hash: await hashUsercode(usercode), must_change_code: true, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
  return { usercode };
}

export async function unlockAccountAction(id: string) {
  await guard(id);
  const { error } = await supabaseAdmin.from("staff_accounts").update({ failed_attempts: 0, locked_until: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}

// Move a technician to another unit.
export async function setUnitAction(id: string, unit: string) {
  await guard(id);
  if (!isUnit(unit)) throw new Error("Choose one of the five units.");
  if ((await getTargetRole(id)) !== "maintenance_technician") throw new Error("Only technicians belong to a unit.");
  const { error } = await supabaseAdmin.from("staff_accounts").update({ unit, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}
