"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function logVehicleEntryAction(input: { cardNumber: string; plateNumber: string; driverName: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.cardNumber.trim() || !input.plateNumber.trim()) throw new Error("Card number and plate number are required.");

  const { error } = await supabaseAdmin.from("vehicle_logs").insert({
    card_number: input.cardNumber.trim(),
    plate_number: input.plateNumber.trim(),
    driver_name: input.driverName.trim() || null,
    status: "In",
    logged_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
}

export async function returnVehicleCardAction(id: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin.from("vehicle_logs").update({ status: "Returned", exit_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
}
