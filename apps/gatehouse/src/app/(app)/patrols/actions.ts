"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { finishPatrol, getPatrols, startPatrol, voidPatrol } from "@/lib/data/patrols";

const refresh = () => revalidatePath("/", "layout");

async function startPatrolAction__run(route: string) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!route.trim()) throw new Error("Say which route you’re walking.");
  const mine = (await getPatrols()).find((p) => !p.void && p.status === "In Progress" && p.officer_id === session.staffId);
  if (mine) throw new Error(`You’re already on a patrol (${mine.route}). Finish it first.`);
  await startPatrol(route.trim(), session.staffId);
  refresh();
}

// An officer finishes their own patrol; the Supervisor or Admin can finish anyone's.
async function finishPatrolAction__run(id: string, notes: string) {
  const session = await requireRole(GH_CAN_EDIT);
  const p = (await getPatrols()).find((x) => x.id === id);
  if (!p) throw new Error("That patrol wasn’t found.");
  if (session.role === "security_officer" && p.officer_id !== session.staffId) throw new Error(`This is ${p.officer_name}’s patrol. They, the Supervisor or the Admin can finish it.`);
  await finishPatrol(id, notes.trim() || null);
  refresh();
}

async function voidPatrolAction__run(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a patrol.");
  await voidPatrol(id, reason.trim(), session.staffId);
  refresh();
}

export async function startPatrolAction(...args: Parameters<typeof startPatrolAction__run>) {
  return guarded(() => startPatrolAction__run(...args));
}

export async function finishPatrolAction(...args: Parameters<typeof finishPatrolAction__run>) {
  return guarded(() => finishPatrolAction__run(...args));
}

export async function voidPatrolAction(...args: Parameters<typeof voidPatrolAction__run>) {
  return guarded(() => voidPatrolAction__run(...args));
}
