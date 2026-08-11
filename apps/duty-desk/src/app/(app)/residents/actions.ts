"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_RESIDENTS } from "@/lib/types";

export async function addResidentAction(input: {
  name: string;
  room: string;
  checkIn: string;
  checkOut: string;
  preferences: string;
  contactInfo: string;
  notes: string;
}) {
  const session = await requireRole(DD_CAN_EDIT_RESIDENTS);
  if (!input.name.trim() || !input.room.trim()) throw new Error("Name and room are required.");

  const { error } = await supabaseAdmin.from("resident_profiles").insert({
    name: input.name.trim(),
    room: input.room.trim(),
    check_in: input.checkIn || null,
    check_out: input.checkOut || null,
    preferences: input.preferences.trim() || null,
    contact_info: input.contactInfo.trim() || null,
    notes: input.notes.trim() || null,
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/residents");
}
