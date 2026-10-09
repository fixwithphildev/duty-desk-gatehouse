import "server-only";
import { cache } from "react";
import { getCardsOut, getVehicleLogsSince } from "./vehicles";
import { getItemLogs } from "./items";
import { getPatrols } from "./patrols";
import { getIncidents } from "./incidents";
import { getAlerts } from "./alerts";
import { getRackSize } from "./settings";

// Everything the Gatehouse pages show, read once per request (the menu
// counts, the alert banner and the page share it). Gate volumes are small,
// so incidents, alerts, items and patrols are read whole; vehicles are the
// cards out now plus the last week of entries and exits.
export const getDesk = cache(async function getDesk() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [out, recent, items, patrols, incidents, alerts, rackSize] = await Promise.all([
    getCardsOut(),
    getVehicleLogsSince(weekAgo),
    getItemLogs(),
    getPatrols(),
    getIncidents(),
    getAlerts(),
    getRackSize(),
  ]);
  return { out, recent, items, patrols, incidents, alerts, rackSize };
});

export type Desk = Awaited<ReturnType<typeof getDesk>>;

// The alert to show above every page: the oldest one nobody has
// acknowledged yet, otherwise the newest one acknowledged but not resolved.
export function bannerAlert(alerts: Desk["alerts"]) {
  const live = alerts.filter((a) => !a.void && a.status !== "Resolved");
  const unack = live.filter((a) => a.status === "Unacknowledged").sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { alert: unack[0] ?? live[0] ?? null, more: Math.max(0, live.length - 1) };
}
