import "server-only";
import { getReadiness, countByStatus, leavingToday, todoList } from "@/lib/data/readiness";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { getTasks } from "@/lib/data/tasks";
import { findApartment } from "@/lib/apartments";
import { taskState, byDue } from "@/lib/tasks";

const some = (xs: string[], n = 8) => (xs.length > n ? `${xs.slice(0, n).join(", ")} and ${xs.length - n} more` : xs.join(", "));

// "Draft my handover": what's still open, for the officer to check and add to before saving.
export async function draftHandover(): Promise<string> {
  const [readiness, complaints, tickets, tasks] = await Promise.all([getReadiness(), getComplaints(), getMaintenanceTickets(), getTasks()]);
  const c = countByStatus(readiness);
  const notReady = readiness.filter((r) => r.status === "notready").map((r) => r.apartment.name);
  const todo = todoList(readiness).map((r) => r.apartment.name);
  const inspecting = readiness.filter((r) => r.draft).map((r) => `${r.apartment.name} (${r.draft!.prepared_by_name})`);
  const leaving = leavingToday(readiness).map((r) => `${r.apartment.name} (${r.stay!.guest})`);
  const oc = complaints.filter((x) => !x.void && x.status !== "Resolved");
  const ot = tickets.filter((x) => !x.void && x.status !== "Resolved");
  const high = ot.filter((x) => x.priority === "High");
  const open = tasks.filter((t) => !t.void && t.status === "Pending").map((t) => ({ ...t, state: taskState(t) })).sort(byDue);

  return [
    `Apartments: ${c.ready} ready to sell, ${c.notready} not ready${notReady.length ? ` (${some(notReady)})` : ""}, ${todo.length} still need a check-in prep${todo.length ? ` (${some(todo)})` : ""}.`,
    inspecting.length ? `Inspections not finished: ${some(inspecting)}.` : "",
    leaving.length ? `Check-outs still to record today: ${some(leaving)}.` : "",
    `Complaints open: ${oc.length}${oc.length ? ` (${oc.slice(0, 6).map((x) => `${findApartment(x.room)?.name ?? x.room ?? "?"}: ${x.category.toLowerCase()}`).join("; ")}${oc.length > 6 ? `; and ${oc.length - 6} more` : ""})` : ""}.`,
    `Repair tickets open: ${ot.length}${high.length ? `, high priority: ${some(high.map((x) => `${x.issue_type} in ${x.area.replace(/^apartment\s+/i, "")}`), 5)}` : ""}.`,
    `Tasks not done: ${open.length ? open.slice(0, 8).map((t) => `${t.due_time ? t.due_time + " " : ""}${t.description}${t.apartments.length ? ` (${t.apartments.join(", ")})` : ""}${t.state === "overdue" ? " (overdue)" : ""}`).join("; ") + (open.length > 8 ? `; and ${open.length - 8} more` : "") : "none"}.`,
  ].filter(Boolean).join("\n");
}
