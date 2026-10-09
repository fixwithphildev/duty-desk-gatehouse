import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { incRef, type IncidentStatus, type Severity } from "@/lib/types";

export interface Incident {
  id: string;
  ref: string; // "INC-0042"
  title: string;
  category: string;
  severity: Severity;
  location: string | null;
  description: string | null;
  reported_by_name: string;
  status: IncidentStatus;
  resolution_notes: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

// Explicit FK names: incidents has several foreign keys into staff_accounts.
const COLS =
  "id, ref_no, title, category, severity, location, description, status, resolution_notes, resolved_at, created_at, updated_at, void, void_reason, " +
  "reporter:staff_accounts!incidents_reported_by_fkey(display_name), resolver:staff_accounts!incidents_resolved_by_fkey(display_name), " +
  "voider:staff_accounts!incidents_voided_by_fkey(display_name)";

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

export async function getIncidents(): Promise<Incident[]> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("incidents").select(COLS).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => ({
    id: r.id as string,
    ref: incRef((r.ref_no as number | null) ?? null),
    title: r.title as string,
    category: r.category as string,
    severity: r.severity as Severity,
    location: (r.location as string | null) || null,
    description: (r.description as string | null) || null,
    reported_by_name: name(r.reporter) ?? "—",
    status: r.status as IncidentStatus,
    resolution_notes: (r.resolution_notes as string | null) || null,
    resolved_by_name: name(r.resolver),
    resolved_at: (r.resolved_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string | null) ?? (r.created_at as string),
    void: !!r.void,
    void_reason: (r.void_reason as string | null) ?? null,
    voided_by_name: name(r.voider),
  }));
}

export async function createIncident(input: { title: string; category: string; severity: Severity; location: string | null; description: string | null }, staffId: string): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin
    .from("incidents")
    .insert({ ...input, status: "Open", reported_by: staffId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn’t log the incident.");
  return { id: data.id as string };
}

export async function setIncidentStatus(id: string, status: IncidentStatus, staffId: string, notes: string | null): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "Resolved") Object.assign(patch, { resolution_notes: notes, resolved_by: staffId, resolved_at: now });
  else Object.assign(patch, { resolved_by: null, resolved_at: null });
  const { error } = await supabaseAdmin.from("incidents").update(patch).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
}

export async function voidIncident(id: string, reason: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("incidents").update({ void: true, void_reason: reason, voided_by: staffId, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
