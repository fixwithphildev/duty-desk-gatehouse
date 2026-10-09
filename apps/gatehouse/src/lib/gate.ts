// Small helpers for the gate pages, safe to use in the browser too.
import { OVERDUE_MINUTES } from "./types";

export const minsSince = (iso: string, to = Date.now()) => Math.max(0, Math.round((to - new Date(iso).getTime()) / 60000));

// "45m", "2h 14m", "1d 3h"
export function fmtDur(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

export const isOverdue = (entryIso: string) => minsSince(entryIso) >= OVERDUE_MINUTES;

// Plates are written the way they're printed: upper case, single spaces/dashes.
export const normPlate = (p: string) => p.trim().toUpperCase().replace(/\s+/g, " ");

export const pl = (n: number, w: string, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;
