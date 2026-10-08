import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS, DD_CAN_EDIT_TICKETS, DD_CAN_VOID } from "@/lib/types";
import { getMaintenanceTickets, getTicketOrigins } from "@/lib/data/maintenance";
import { getReadiness } from "@/lib/data/readiness";
import { findApartment, aptKey, aptWhere } from "@/lib/apartments";
import { ageText, whenText } from "@/lib/time";
import { MaintenanceClient, type TicketView, type AptState } from "./maintenance-client";

export const maxDuration = 30;

export default async function MaintenancePage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requirePageAccess("/maintenance");

  // Housekeeping/Engineering only see tickets assigned to their own department
  // (blueprint 4.3: "Can view: Assigned tickets"); everyone else sees all.
  let assignedFilter: string[] | undefined;
  if (session.role === "housekeeping") assignedFilter = ["Housekeeping"];
  if (session.role === "engineering") assignedFilter = ["Engineering", "General Maintenance"];

  const [tickets, origins, readiness] = await Promise.all([getMaintenanceTickets(assignedFilter), getTicketOrigins(), getReadiness()]);

  const views: TicketView[] = tickets.map((t) => {
    const apt = findApartment(t.area.replace(/^apartment\s+/i, ""));
    return {
      ...t,
      apartment: apt?.name ?? null,
      where: apt ? aptWhere(apt) : null,
      openedWhen: whenText(t.created_at),
      updatedWhen: t.updated_at !== t.created_at ? whenText(t.updated_at) : null,
      voidedWhen: t.voided_at ? whenText(t.voided_at) : null,
      age: ageText(t.created_at),
      complaintId: origins.complaint.get(t.id) ?? null,
      checklistId: origins.checklist.get(t.id) ?? null,
    };
  });

  // Where each apartment with a ticket stands, for the "can't be sold" badge and the
  // "all repairs done, run a new check-in prep" prompt.
  const withTickets = new Set(views.map((v) => v.apartment).filter(Boolean) as string[]);
  const apts: Record<string, AptState> = {};
  for (const r of readiness) {
    if (!withTickets.has(r.apartment.name)) continue;
    apts[aptKey(r.apartment.name)] = {
      status: r.status,
      repairsDone: r.status === "notready" && r.flags.every((f) => !f.ticketId || f.ticketStatus === "Resolved"),
      draft: r.draft ? { id: r.draft.id, by: r.draft.prepared_by_name, mine: r.draft.prepared_by === session.staffId } : null,
    };
  }

  return (
    <MaintenanceClient
      tickets={views}
      apts={apts}
      initialId={searchParams.id ?? null}
      canEdit={DD_CAN_EDIT_TICKETS.includes(session.role)}
      canVoid={DD_CAN_VOID.includes(session.role)}
      canPrep={DD_CAN_EDIT_CHECKLISTS.includes(session.role)}
      me={session.displayName}
    />
  );
}
