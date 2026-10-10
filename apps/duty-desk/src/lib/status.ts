// An apartment's sale status, shared by the server and the pages' own scripts.
// lib/data/readiness.ts works out which one each apartment has.
export type ReadyStatus = "ready" | "recheck" | "maintenance" | "repaired" | "notready" | "inspecting" | "unchecked" | "occupied";

export const STATUS_LABEL: Record<ReadyStatus, string> = {
  ready: "Ready to sell",
  recheck: "Re-check due",
  maintenance: "Under maintenance",
  repaired: "Repairs done",
  notready: "Not ready",
  inspecting: "Inspecting",
  unchecked: "Needs checklist",
  occupied: "Occupied",
};

// Colour family for badges (t-…), stripes (s-…) and tiles.
export const STATUS_TONE: Record<ReadyStatus, "ok" | "warn" | "maint" | "bad" | "info" | "neu"> = {
  ready: "ok",
  recheck: "warn",
  maintenance: "maint",
  repaired: "maint",
  notready: "bad",
  inspecting: "info",
  unchecked: "neu",
  occupied: "neu",
};

// Every status, in the order the board, legends and charts list them.
export const STATUS_ORDER: ReadyStatus[] = ["ready", "recheck", "maintenance", "repaired", "notready", "inspecting", "unchecked", "occupied"];

// Apartments waiting for a check-in prep, in the order to do them: repaired ones
// first (they're one check away from selling), then those a guest has left.
const TODO_RANK: Partial<Record<ReadyStatus, number>> = { repaired: 0, unchecked: 1, notready: 2, recheck: 3 };
export const isTodo = (s: ReadyStatus) => TODO_RANK[s] !== undefined;
export const todoRank = (s: ReadyStatus) => TODO_RANK[s] ?? 9;
