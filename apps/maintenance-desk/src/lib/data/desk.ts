import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { getTickets, isRequest, type Ticket } from "@/lib/data/tickets";
import { getExpenses, getNoPurchaseIds, type ExpenseLine } from "@/lib/data/expenses";
import { getFunding } from "@/lib/data/funding";
import { fundStage } from "@/lib/funding";
import { findApartment, aptWhere } from "@/lib/apartments";
import { ageText, lagosDayKey, whenText } from "@/lib/time";
import { LEGACY_UNITS, ticketRef, type MDRole } from "@/lib/types";
import type { JobView } from "@/lib/jobs";

const FROM: Record<string, string> = { checklist: "Check-in prep", complaint: "Guest complaint", report: "Problem report", request: "Request" };

function toJob(t: Ticket, lines: ExpenseLine[], noPurchase: boolean, funding: JobView["funding"]): JobView {
  const apt = findApartment(t.area.replace(/^apartment\s+/i, ""));
  const today = lagosDayKey(new Date().toISOString());
  const resolvedAt = t.resolved_at ?? (t.status === "Resolved" ? t.updated_at : null);
  const cost = Math.round(lines.reduce((a, l) => a + l.line_total, 0) * 100) / 100;
  const request = isRequest(t);
  return {
    id: t.id,
    ref: ticketRef(t.ref_no),
    title: t.issue_type,
    area: apt ? apt.name : t.area,
    apartment: apt?.name ?? null,
    where: apt ? aptWhere(apt) : null,
    unit: t.assigned_to,
    needsUnit: LEGACY_UNITS.includes(t.assigned_to),
    priority: t.priority,
    status: t.status,
    source: t.source,
    isRequest: request,
    fromLabel: FROM[t.source] ?? (t.created_by_name ? "Logged by Duty Desk" : "Logged by hand"),
    raisedBy: request
      ? `${t.requested_by_name ?? "Someone"} · ${t.requested_by_unit ? `${t.requested_by_unit}, maintenance` : t.requested_by_role ?? "request"}`
      : t.source === "checklist"
        ? `Check-in prep${t.created_by_name ? ` by ${t.created_by_name}` : ""}`
        : t.created_by_name
          ? `${t.created_by_name} via Duty Desk`
          : t.logged_by_name ?? "Duty Desk",
    requester: request ? { name: t.requested_by_name ?? "Someone", role: t.requested_by_role ?? "Other", unit: t.requested_by_unit } : null,
    notes: t.notes,
    createdAt: t.created_at,
    createdWhen: whenText(t.created_at),
    age: ageText(t.created_at),
    startedBy: t.started_by_name,
    startedAt: t.started_at,
    startedWhen: t.started_at ? whenText(t.started_at) : null,
    resolvedBy: t.resolved_by_name,
    resolvedAt,
    resolvedWhen: resolvedAt ? whenText(resolvedAt) : null,
    resolvedToday: t.status === "Resolved" && !!resolvedAt && lagosDayKey(resolvedAt) === today,
    fixNote: t.fix_note,
    blocksSale: t.blocks_sale,
    photoCount: t.photo_count,
    cost,
    lines: lines.map((l) => ({ id: l.id, item: l.item, quantity: l.quantity, unit_cost: l.unit_cost, line_total: l.line_total, supplier: l.supplier, purchased_on: l.purchased_on, recorded_by_name: l.recorded_by_name })),
    noPurchase,
    funding,
    fundStage: fundStage(funding, t.status === "Resolved", cost),
    void: t.void,
    voidReason: t.void_reason,
    voidedBy: t.voided_by_name,
  };
}

export interface Desk {
  jobs: JobView[];
  expenses: ExpenseLine[]; // every live purchase line, jobs and stock
}

// Everything the pages need, read once per request (the menu counts share it).
export const getDesk = cache(async function getDesk(): Promise<Desk> {
  const [tickets, expenses, funding, noPurchase] = await Promise.all([getTickets(), getExpenses(), getFunding(), getNoPurchaseIds()]);
  const byTicket = new Map<string, ExpenseLine[]>();
  for (const e of expenses) if (e.ticket_id) byTicket.set(e.ticket_id, [...(byTicket.get(e.ticket_id) ?? []), e]);
  const jobs = tickets.map((t) => toJob(t, byTicket.get(t.id) ?? [], noPurchase.has(t.id), funding.get(t.id) ?? null));
  return { jobs, expenses };
});

// The technicians of each unit (for "who did it"), and the people who can ask
// for work from inside Maintenance (the Manager and Supervisor).
export const getTeam = cache(async function getTeam(): Promise<{ byUnit: Record<string, string[]>; office: { name: string; role: string }[] }> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("display_name, role, unit").eq("disabled", false).order("display_name");
  const byUnit: Record<string, string[]> = {};
  const office: { name: string; role: string }[] = [];
  for (const s of data ?? []) {
    const role = s.role as MDRole;
    if (role === "maintenance_technician" && s.unit) (byUnit[s.unit as string] ??= []).push(s.display_name as string);
    if (role === "maintenance_manager" || role === "maintenance_supervisor") office.push({ name: s.display_name as string, role: role === "maintenance_manager" ? "Maintenance Manager" : "Maintenance Supervisor" });
  }
  return { byUnit, office };
});

export async function getMyUnit(staffId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("unit").eq("id", staffId).maybeSingle();
  return (data?.unit as string | null) ?? null;
}
