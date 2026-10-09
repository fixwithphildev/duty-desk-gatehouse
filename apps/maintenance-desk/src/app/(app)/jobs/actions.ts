"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { isUnit, MD_MANAGE_ROLES, MD_PRIORITIES, MD_WORK_ROLES, REQUEST_ROLES, type TicketPriority } from "@/lib/types";
import { assignUnit, createRequest, fillStartIfMissing, getTicket, getTicketPhotoUrls, recordWork, uploadTicketPhoto, voidTicket } from "@/lib/data/tickets";
import { addPurchase, markNoPurchase } from "@/lib/data/expenses";
import { getMyUnit } from "@/lib/data/desk";
import { findApartment } from "@/lib/apartments";

const refresh = () => {
  for (const p of ["/dashboard", "/board", "/requests", "/costs", "/funding", "/spending"]) revalidatePath(p);
};

// A time the work happened: not more than a few minutes in the future.
function validTime(iso: string, what: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) throw new Error(`Give the time ${what}.`);
  if (t.getTime() > Date.now() + 5 * 60 * 1000) throw new Error(`The time ${what} can’t be in the future.`);
  return t.toISOString();
}

// Loads the job and checks this person may work on it: technicians only in their own unit.
async function jobForWork(id: string) {
  const session = await requireRole(MD_WORK_ROLES);
  const job = await getTicket(id);
  if (!job || job.void) throw new Error("That job isn’t there any more.");
  if (session.role === "maintenance_technician") {
    const unit = await getMyUnit(session.staffId);
    if (!unit || unit !== job.assigned_to) throw new Error(`This job belongs to ${job.assigned_to}. Only that unit, the Manager or the Supervisor can work on it.`);
  }
  return { session, job };
}

async function startWorkAction__run(id: string, who: string, at: string) {
  const { session, job } = await jobForWork(id);
  if (!who.trim()) throw new Error("Choose who is doing it.");
  if (job.status !== "Reported") throw new Error("This job has already been started.");
  await recordWork(id, { status: "In Progress", who: who.trim(), at: validTime(at, "the work started"), note: null, loggedBy: session.displayName });
  refresh();
}

async function resolveWorkAction__run(id: string, who: string, at: string, note: string) {
  const { session, job } = await jobForWork(id);
  if (!who.trim()) throw new Error("Choose who fixed it.");
  if (!note.trim()) throw new Error("Say what was done. Duty Desk sees this.");
  if (job.status === "Resolved") throw new Error("This job is already finished.");
  const when = validTime(at, "it was finished");
  if (job.started_at && when < job.started_at) throw new Error("It can’t be finished before it was started.");
  await recordWork(id, { status: "Resolved", who: who.trim(), at: when, note: note.trim(), loggedBy: session.displayName });
  // Finished without a recorded start: the same person started it.
  if (!job.started_at) await fillStartIfMissing(id, who.trim(), when);
  refresh();
}

async function reopenAction__run(id: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  await recordWork(id, { status: "Reported", who: "", at: new Date().toISOString(), note: null, loggedBy: session.displayName });
  refresh();
}

async function assignUnitAction__run(id: string, unit: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!isUnit(unit)) throw new Error("Choose one of the five units.");
  await assignUnit(id, unit, session.displayName);
  refresh();
}

async function voidJobAction__run(id: string, reason: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!reason.trim()) throw new Error("A reason is required to void a job.");
  await voidTicket(id, reason.trim(), session.displayName);
  refresh();
}

async function getPhotosAction__run(id: string): Promise<string[]> {
  await requireSession();
  return getTicketPhotoUrls(id);
}

async function addPhotoAction__run(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await jobForWork(id);
  const photo = formData.get("photo") as File | null;
  if (!photo || photo.size === 0) throw new Error("Choose a photo first.");
  if (photo.size > 4 * 1024 * 1024) throw new Error("That photo is too large (4 MB at most).");
  await uploadTicketPhoto(id, photo);
  refresh();
}

// A purchase or two straight from the job. Several items, a supplier or a date go on the Costs page.
async function quickPurchaseAction__run(id: string, item: string, quantity: number, unitCost: number) {
  const session = await requireRole(MD_MANAGE_ROLES);
  const job = await getTicket(id);
  if (!job) throw new Error("That job isn’t there any more.");
  if (!item.trim()) throw new Error("Say what was bought.");
  if (!(quantity > 0)) throw new Error("The quantity must be more than 0.");
  if (!(unitCost >= 0) || unitCost > 50_000_000) throw new Error("Give the unit cost in Naira.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  await addPurchase({ unit: isUnit(job.assigned_to) ? job.assigned_to : "General Maintenance", ticketId: id, supplier: null, purchasedOn: today, lines: [{ item: item.trim(), quantity, unitCost }] }, { staffId: session.staffId, name: session.displayName });
  refresh();
}

async function markNoPurchaseAction__run(id: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  await markNoPurchase(id, session.displayName);
  refresh();
}

// A request: work asked for outside Duty Desk. No amount on it; what it costs goes on Costs.
async function createRequestAction__run(input: {
  fromMaintenance: boolean;
  name: string;
  role: string;
  staffUnit: string;
  area: string;
  what: string;
  unit: string;
  priority: string;
}): Promise<{ id: string }> {
  const session = await requireRole(MD_MANAGE_ROLES);
  const name = input.name.trim(), what = input.what.trim(), rawArea = input.area.trim();
  if (!name) throw new Error(input.fromMaintenance ? "Choose who in Maintenance is asking." : "Say who is asking.");
  if (!rawArea) throw new Error("Say where the work is.");
  if (!what) throw new Error("Describe what needs doing.");
  if (!isUnit(input.unit)) throw new Error("Choose the unit that will do it.");
  if (!(MD_PRIORITIES as readonly string[]).includes(input.priority)) throw new Error("Choose a priority.");
  const role = input.fromMaintenance ? "Maintenance team" : REQUEST_ROLES.includes(input.role) ? input.role : "Other";
  const apt = findApartment(rawArea);
  const title = what.split(/[.\n]/)[0].trim().slice(0, 80) || what.slice(0, 80);
  const r = await createRequest({
    area: apt ? `Apartment ${apt.name}` : rawArea,
    issue: title,
    notes: what === title ? "" : what,
    unit: input.unit,
    priority: input.priority as TicketPriority,
    requestedByName: name,
    requestedByRole: role,
    requestedByUnit: input.fromMaintenance && isUnit(input.staffUnit) ? input.staffUnit : null,
    loggedBy: session.displayName,
  });
  refresh();
  return r;
}

export async function startWorkAction(...args: Parameters<typeof startWorkAction__run>) {
  return guarded(() => startWorkAction__run(...args));
}

export async function resolveWorkAction(...args: Parameters<typeof resolveWorkAction__run>) {
  return guarded(() => resolveWorkAction__run(...args));
}

export async function reopenAction(...args: Parameters<typeof reopenAction__run>) {
  return guarded(() => reopenAction__run(...args));
}

export async function assignUnitAction(...args: Parameters<typeof assignUnitAction__run>) {
  return guarded(() => assignUnitAction__run(...args));
}

export async function voidJobAction(...args: Parameters<typeof voidJobAction__run>) {
  return guarded(() => voidJobAction__run(...args));
}

export async function getPhotosAction(...args: Parameters<typeof getPhotosAction__run>) {
  return guarded(() => getPhotosAction__run(...args));
}

export async function addPhotoAction(...args: Parameters<typeof addPhotoAction__run>) {
  return guarded(() => addPhotoAction__run(...args));
}

export async function quickPurchaseAction(...args: Parameters<typeof quickPurchaseAction__run>) {
  return guarded(() => quickPurchaseAction__run(...args));
}

export async function markNoPurchaseAction(...args: Parameters<typeof markNoPurchaseAction__run>) {
  return guarded(() => markNoPurchaseAction__run(...args));
}

export async function createRequestAction(...args: Parameters<typeof createRequestAction__run>) {
  return guarded(() => createRequestAction__run(...args));
}
