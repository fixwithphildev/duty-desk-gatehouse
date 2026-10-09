"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID, GH_SEVERITIES, type Severity } from "@/lib/types";
import { GH_ALERT_TYPES } from "@/lib/constants";
import { acknowledgeAlert, raiseAlert, resolveAlert, voidAlert } from "@/lib/data/alerts";

const refresh = () => revalidatePath("/", "layout");

async function raiseAlertAction__run(input: { type: string; severity: string; location: string; message: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!GH_ALERT_TYPES.includes(input.type)) throw new Error("Choose the type of alert.");
  if (!GH_SEVERITIES.includes(input.severity as Severity)) throw new Error("Choose a severity.");
  if (!input.message.trim()) throw new Error("Say what’s happening and what’s needed.");
  await raiseAlert({ type: input.type, severity: input.severity as Severity, location: input.location.trim() || null, message: input.message.trim() }, session.staffId);
  refresh();
}

async function acknowledgeAlertAction__run(id: string) {
  const session = await requireRole(GH_CAN_EDIT);
  await acknowledgeAlert(id, session.staffId);
  refresh();
}

async function resolveAlertAction__run(id: string, notes: string) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!notes.trim()) throw new Error("Say how it was resolved, for example the all-clear.");
  await resolveAlert(id, notes.trim(), session.staffId);
  refresh();
}

async function voidAlertAction__run(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void an alert.");
  await voidAlert(id, reason.trim(), session.staffId);
  refresh();
}

export async function raiseAlertAction(...args: Parameters<typeof raiseAlertAction__run>) {
  return guarded(() => raiseAlertAction__run(...args));
}

export async function acknowledgeAlertAction(...args: Parameters<typeof acknowledgeAlertAction__run>) {
  return guarded(() => acknowledgeAlertAction__run(...args));
}

export async function resolveAlertAction(...args: Parameters<typeof resolveAlertAction__run>) {
  return guarded(() => resolveAlertAction__run(...args));
}

export async function voidAlertAction(...args: Parameters<typeof voidAlertAction__run>) {
  return guarded(() => voidAlertAction__run(...args));
}
