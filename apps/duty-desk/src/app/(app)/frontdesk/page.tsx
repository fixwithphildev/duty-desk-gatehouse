import { requirePageAccess } from "@/lib/auth";
import { getReadiness, READY_DAYS } from "@/lib/data/readiness";
import { toBoardApt } from "@/lib/board";
import { clockTime } from "@/lib/time";
import { FrontDeskClient } from "./frontdesk-client";

const lagosDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });

// Front desk's page: which apartments can be sold right now. Read only.
export default async function FrontDeskPage({ searchParams }: { searchParams: { apt?: string } }) {
  const session = await requirePageAccess("/frontdesk");
  const readiness = await getReadiness();
  const today = lagosDay(new Date().toISOString());
  const justReady = readiness
    .filter((r) => r.status === "ready" && r.lastPrep && lagosDay(r.lastPrep.at) === today)
    .sort((a, b) => b.lastPrep!.at.localeCompare(a.lastPrep!.at))
    .map((r) => ({ name: r.apartment.name, type: r.apartment.type, at: clockTime(r.lastPrep!.at), by: r.lastPrep!.by }));
  return <FrontDeskClient key={searchParams.apt ?? ""} initialApt={searchParams.apt ?? ""} apts={readiness.map((r) => toBoardApt(r, session.staffId))} justReady={justReady} readyDays={READY_DAYS} />;
}
