"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_CHARGE_DAMAGE, DD_CAN_EDIT_RESIDENTS, DD_CAN_VOID } from "@/lib/types";
import { findApartment } from "@/lib/apartments";
import { getReadiness } from "@/lib/data/readiness";
import type { DamageItem } from "@/lib/data/residents";

const KEYS = ["Yes", "Partly", "No"];
// A guard against typing mistakes (an extra few zeros), not a policy limit.
const MAX_CHARGE = 10_000_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const lagosToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

const refresh = () => {
  revalidatePath("/residents");
  revalidatePath("/board");
  revalidatePath("/frontdesk");
  revalidatePath("/dashboard");
};

function validTime(iso: string, label: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) throw new Error(`Give the time the guest ${label}.`);
  if (t.getTime() > Date.now() + 10 * 60 * 1000) throw new Error(`The time the guest ${label} can’t be in the future.`);
  return t.toISOString();
}

// Records a guest moving in. Only an apartment that's Ready to sell can be checked in; it then
// shows Occupied until the check-out is recorded.
export async function checkInAction(input: { apartment: string; guest: string; arrivedAt: string; leaves: string; contact: string; preferences: string }): Promise<{ id: string }> {
  const session = await requireRole(DD_CAN_EDIT_RESIDENTS);
  const apt = findApartment(input.apartment);
  if (!apt) throw new Error("Choose the apartment from the list.");
  if (!input.guest.trim()) throw new Error("Give the guest’s name.");
  if (input.leaves && !DATE.test(input.leaves)) throw new Error("Give the check-out date.");
  if (input.leaves && input.leaves < lagosToday()) throw new Error("The check-out date has already passed.");
  const arrived = validTime(input.arrivedAt, "arrived");

  const r = (await getReadiness()).find((x) => x.apartment.name === apt.name);
  if (r?.status === "occupied") throw new Error(`${apt.name} already has a guest checked in (${r.stay?.guest}). Record their check-out first.`);
  if (r?.status !== "ready") throw new Error(`${apt.name} isn’t ready to sell, so it can’t be checked in. Only green apartments can be.`);

  const { data, error } = await supabaseAdmin
    .from("resident_profiles")
    .insert({
      name: input.guest.trim(),
      room: apt.name,
      check_in: new Date(arrived).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }),
      check_out: input.leaves || null,
      contact_info: input.contact.trim() || null,
      preferences: input.preferences.trim() || null,
      checked_in_at: arrived,
      checked_in_by: session.staffId,
      created_by: session.staffId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  refresh();
  return { id: data.id };
}

// Records a guest leaving: when, whether keys came back, and any damage front desk should charge.
// The apartment then needs a check-in prep before it can be sold again.
export async function checkOutAction(input: { id: string; leftAt: string; keys: string; damage: DamageItem[]; notes: string }) {
  const session = await requireRole(DD_CAN_EDIT_RESIDENTS);
  if (!KEYS.includes(input.keys)) throw new Error("Say whether the keys came back.");
  const left = validTime(input.leftAt, "left");
  const damage = input.damage
    .map((d) => ({ item: String(d.item ?? "").trim(), charge: Math.max(0, Math.round(Number(d.charge) || 0)) }))
    .filter((d) => d.item);
  if (input.damage.some((d) => String(d.item ?? "").trim() && !(Number(d.charge) > 0))) throw new Error("Give a charge for each damaged item.");
  if (damage.some((d) => d.charge > MAX_CHARGE)) throw new Error("One of the charges is over ₦10,000,000. Check the amount.");

  const { data: stay } = await supabaseAdmin.from("resident_profiles").select("checked_in_at, checked_out_at, void").eq("id", input.id).maybeSingle();
  if (!stay || stay.void) throw new Error("That guest record isn’t there any more.");
  if (!stay.checked_in_at) throw new Error("This guest’s check-in wasn’t recorded in Duty Desk.");
  if (stay.checked_out_at) throw new Error("This guest’s check-out was already recorded.");
  if (left < stay.checked_in_at) throw new Error("The guest can’t leave before they arrived.");

  const { error } = await supabaseAdmin
    .from("resident_profiles")
    .update({
      checked_out_at: left,
      checked_out_by: session.staffId,
      check_out: new Date(left).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }),
      keys_returned: input.keys,
      damage: damage.length ? damage : null,
      checkout_notes: input.notes.trim() || null,
    })
    .eq("id", input.id)
    .is("checked_out_at", null);
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateStayAction(input: { id: string; leaves: string; contact: string; preferences: string; notes: string }) {
  await requireRole(DD_CAN_EDIT_RESIDENTS);
  if (input.leaves && !DATE.test(input.leaves)) throw new Error("Give the check-out date.");
  const { error } = await supabaseAdmin
    .from("resident_profiles")
    .update({
      check_out: input.leaves || null,
      contact_info: input.contact.trim() || null,
      preferences: input.preferences.trim() || null,
      notes: input.notes.trim() || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function markDamageChargedAction(id: string) {
  const session = await requireRole(DD_CAN_CHARGE_DAMAGE);
  const { error } = await supabaseAdmin
    .from("resident_profiles")
    .update({ damage_charged_at: new Date().toISOString(), damage_charged_by: session.staffId })
    .eq("id", id)
    .is("damage_charged_at", null);
  if (error) throw new Error(error.message);
  refresh();
}

export async function voidResidentAction(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a resident record.");
  const { error } = await supabaseAdmin
    .from("resident_profiles")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
