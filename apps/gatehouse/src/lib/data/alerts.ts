import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { AlertStatus, Severity } from "@/lib/types";

// A property-wide alert (fire, medical emergency, security breach,
// lockdown). It shows on every Gatehouse screen until someone acknowledges
// it, and stays there until it's resolved with notes.
export interface Alert {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  location: string | null;
  raised_by_name: string;
  status: AlertStatus;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolution_notes: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

const COLS =
  "id, type, severity, message, location, status, acknowledged_at, resolution_notes, resolved_at, created_at, void, void_reason, " +
  "raiser:staff_accounts!alerts_raised_by_fkey(display_name), acker:staff_accounts!alerts_acknowledged_by_fkey(display_name), " +
  "resolver:staff_accounts!alerts_resolved_by_fkey(display_name), voider:staff_accounts!alerts_voided_by_fkey(display_name)";

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

export async function getAlerts(): Promise<Alert[]> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("alerts").select(COLS).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => ({
    id: r.id as string,
    type: r.type as string,
    severity: r.severity as Severity,
    message: r.message as string,
    location: (r.location as string | null) || null,
    raised_by_name: name(r.raiser) ?? "—",
    status: r.status as AlertStatus,
    acknowledged_by_name: name(r.acker),
    acknowledged_at: (r.acknowledged_at as string | null) ?? null,
    resolution_notes: (r.resolution_notes as string | null) || null,
    resolved_by_name: name(r.resolver),
    resolved_at: (r.resolved_at as string | null) ?? null,
    created_at: r.created_at as string,
    void: !!r.void,
    void_reason: (r.void_reason as string | null) ?? null,
    voided_by_name: name(r.voider),
  }));
}

export async function raiseAlert(input: { type: string; severity: Severity; message: string; location: string | null }, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("alerts").insert({ ...input, raised_by: staffId, status: "Unacknowledged" });
  if (error) throw new Error(error.message);
}

export async function acknowledgeAlert(id: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("alerts")
    .update({ status: "Acknowledged", acknowledged_by: staffId, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "Unacknowledged");
  if (error) throw new Error(error.message);
}

export async function resolveAlert(id: string, notes: string, staffId: string): Promise<void> {
  const now = new Date().toISOString();
  // Resolving an alert nobody acknowledged also counts as acknowledging it.
  const { data } = await supabaseAdmin.from("alerts").select("acknowledged_by").eq("id", id).maybeSingle();
  const patch: Record<string, unknown> = { status: "Resolved", resolution_notes: notes, resolved_by: staffId, resolved_at: now };
  if (!data?.acknowledged_by) Object.assign(patch, { acknowledged_by: staffId, acknowledged_at: now });
  const { error } = await supabaseAdmin.from("alerts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function voidAlert(id: string, reason: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("alerts").update({ void: true, void_reason: reason, voided_by: staffId, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
