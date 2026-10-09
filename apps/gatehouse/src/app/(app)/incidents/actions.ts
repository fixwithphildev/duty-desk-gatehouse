"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID, GH_INCIDENT_STATUSES, GH_SEVERITIES, type IncidentStatus, type Severity } from "@/lib/types";
import { GH_INCIDENT_CATEGORIES } from "@/lib/constants";
import { createIncident, setIncidentStatus, voidIncident } from "@/lib/data/incidents";

const refresh = () => revalidatePath("/", "layout");

async function createIncidentAction__run(input: { title: string; category: string; severity: string; location: string; description: string }): Promise<{ id: string }> {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.title.trim()) throw new Error("Say what happened, in a few words.");
  if (!GH_INCIDENT_CATEGORIES.includes(input.category)) throw new Error("Choose a category.");
  if (!GH_SEVERITIES.includes(input.severity as Severity)) throw new Error("Choose a severity.");
  const r = await createIncident(
    { title: input.title.trim(), category: input.category, severity: input.severity as Severity, location: input.location.trim() || null, description: input.description.trim() || null },
    session.staffId
  );
  refresh();
  return r;
}

// Management only reads; officers, the Supervisor and the Admin move an
// incident along. Resolving needs notes on what was done.
async function setIncidentStatusAction__run(id: string, status: IncidentStatus, notes = "") {
  const session = await requireRole(GH_CAN_EDIT);
  if (!GH_INCIDENT_STATUSES.includes(status)) throw new Error("Unknown status.");
  if (status === "Resolved" && !notes.trim()) throw new Error("Say how it was resolved.");
  await setIncidentStatus(id, status, session.staffId, status === "Resolved" ? notes.trim() : null);
  refresh();
}

async function voidIncidentAction__run(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void an incident.");
  await voidIncident(id, reason.trim(), session.staffId);
  refresh();
}

export async function createIncidentAction(...args: Parameters<typeof createIncidentAction__run>) {
  return guarded(() => createIncidentAction__run(...args));
}

export async function setIncidentStatusAction(...args: Parameters<typeof setIncidentStatusAction__run>) {
  return guarded(() => setIncidentStatusAction__run(...args));
}

export async function voidIncidentAction(...args: Parameters<typeof voidIncidentAction__run>) {
  return guarded(() => voidIncidentAction__run(...args));
}
