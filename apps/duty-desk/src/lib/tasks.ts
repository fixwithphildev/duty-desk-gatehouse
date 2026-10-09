import { isPastDue, lagosDayKey } from "@/lib/time";

// Where a task stands on today's list. A task left over from an earlier day is overdue,
// as is one whose due time ("15:00") has passed. Done tasks drop off after the day they were done.
export type TaskState = "overdue" | "todo" | "done" | "earlier";

export function taskState(t: { status: string; due_time: string | null; created_at: string; done_at?: string | null }): TaskState {
  const today = lagosDayKey(new Date().toISOString());
  if (t.status === "Done") return lagosDayKey(t.done_at ?? t.created_at) === today ? "done" : "earlier";
  return lagosDayKey(t.created_at) < today || isPastDue(t.due_time) ? "overdue" : "todo";
}

// Overdue first, then by due time (no time last), then oldest first.
export function byDue<T extends { due_time: string | null; created_at: string }>(a: T, b: T): number {
  const da = a.due_time?.trim().padStart(5, "0") || "99:99", db = b.due_time?.trim().padStart(5, "0") || "99:99";
  return da.localeCompare(db) || a.created_at.localeCompare(b.created_at);
}
