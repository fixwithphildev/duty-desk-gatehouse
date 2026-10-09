"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID, MAX_RACK_SIZE, cardNo } from "@/lib/types";
import { normPlate } from "@/lib/gate";
import { getCardsOut, logEntry, logExit, voidVehicleLog } from "@/lib/data/vehicles";
import { getRackSize, setRackSize } from "@/lib/data/settings";

const refresh = () => revalidatePath("/", "layout");

// Card first, then plate. A card can't be handed out twice, and the same
// plate can't be on property twice.
async function logEntryAction__run(input: { card: string; plate: string; driver: string }): Promise<{ card: string }> {
  const session = await requireRole(GH_CAN_EDIT);
  const raw = input.card.trim(), plate = normPlate(input.plate);
  if (!raw) throw new Error("Enter the card number.");
  if (!plate) throw new Error("Enter the plate number.");
  const card = cardNo(raw);
  if (/^\d+$/.test(raw)) {
    const n = Number(raw), size = await getRackSize();
    if (n < 1 || n > size) throw new Error(`Card numbers run 001 to ${cardNo(size)}.`);
  }
  const out = await getCardsOut();
  const busy = out.find((v) => v.card === card);
  if (busy) throw new Error(`Card ${card} is already out with ${busy.plate}. Log it out first, or use another card.`);
  const same = out.find((v) => normPlate(v.plate) === plate);
  if (same) throw new Error(`${plate} is already on property with card ${same.card}. Log that card out first.`);
  await logEntry({ card, plate, driver: input.driver.trim() || null }, session.staffId);
  refresh();
  return { card };
}

async function logExitAction__run(cardInput: string): Promise<{ card: string; plate: string }> {
  const session = await requireRole(GH_CAN_EDIT);
  if (!cardInput.trim()) throw new Error("Enter the card that was handed back.");
  const card = cardNo(cardInput);
  const v = (await getCardsOut()).find((x) => x.card === card);
  if (!v) throw new Error(`Card ${card} isn’t out.`);
  await logExit(v.id, session.staffId);
  refresh();
  return { card, plate: v.plate };
}

async function voidVehicleAction__run(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void an entry.");
  await voidVehicleLog(id, reason.trim(), session.staffId);
  refresh();
}

// How many cards the gate has. Admin only.
async function setRackSizeAction__run(n: number) {
  const session = await requireRole(["super_admin"]);
  if (!Number.isInteger(n) || n < 1 || n > MAX_RACK_SIZE) throw new Error(`Enter a number from 1 to ${MAX_RACK_SIZE}.`);
  const highest = Math.max(0, ...(await getCardsOut()).map((v) => Number(v.card)).filter((x) => Number.isFinite(x)));
  if (n < highest) throw new Error(`Card ${cardNo(highest)} is out right now. The rack can’t be smaller than that.`);
  await setRackSize(n, session.displayName);
  refresh();
}

export async function logEntryAction(...args: Parameters<typeof logEntryAction__run>) {
  return guarded(() => logEntryAction__run(...args));
}

export async function logExitAction(...args: Parameters<typeof logExitAction__run>) {
  return guarded(() => logExitAction__run(...args));
}

export async function voidVehicleAction(...args: Parameters<typeof voidVehicleAction__run>) {
  return guarded(() => voidVehicleAction__run(...args));
}

export async function setRackSizeAction(...args: Parameters<typeof setRackSizeAction__run>) {
  return guarded(() => setRackSizeAction__run(...args));
}
