"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { bookItemIn, logItemOut, voidItemLog } from "@/lib/data/items";

const refresh = () => revalidatePath("/", "layout");

async function logItemOutAction__run(input: { item: string; carriedBy: string; authorizedBy: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.item.trim()) throw new Error("Say what is going out.");
  if (!input.carriedBy.trim()) throw new Error("Say who is carrying it.");
  await logItemOut({ item: input.item.trim(), carriedBy: input.carriedBy.trim(), authorizedBy: input.authorizedBy.trim() || null }, session.staffId);
  refresh();
}

async function bookItemInAction__run(id: string) {
  const session = await requireRole(GH_CAN_EDIT);
  await bookItemIn(id, session.staffId);
  refresh();
}

async function voidItemAction__run(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void an entry.");
  await voidItemLog(id, reason.trim(), session.staffId);
  refresh();
}

export async function logItemOutAction(...args: Parameters<typeof logItemOutAction__run>) {
  return guarded(() => logItemOutAction__run(...args));
}

export async function bookItemInAction(...args: Parameters<typeof bookItemInAction__run>) {
  return guarded(() => bookItemInAction__run(...args));
}

export async function voidItemAction(...args: Parameters<typeof voidItemAction__run>) {
  return guarded(() => voidItemAction__run(...args));
}
