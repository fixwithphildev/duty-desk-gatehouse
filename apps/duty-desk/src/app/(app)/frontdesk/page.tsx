import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_CHARGE_DAMAGE } from "@/lib/types";
import { getDamageToCharge } from "@/lib/data/residents";
import { findApartment } from "@/lib/apartments";
import { damageTotal } from "@/lib/money";
import { DamageCard } from "./damage-card";
import { getReadiness, READY_DAYS } from "@/lib/data/readiness";
import { toBoardApt } from "@/lib/board";
import { clockTime, whenText } from "@/lib/time";
import { FrontDeskClient } from "./frontdesk-client";

const lagosDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });

// Front desk's page: which apartments can be sold right now, and damage to charge guests who've left.
export default async function FrontDeskPage({ searchParams }: { searchParams: { apt?: string } }) {
  const session = await requirePageAccess("/frontdesk");
  const [readiness, damage] = await Promise.all([getReadiness(), getDamageToCharge()]);
  const bills = damage.map((d) => ({ id: d.id, guest: d.name, apartment: findApartment(d.room)?.name ?? d.room, left: whenText(d.checked_out_at!), by: d.checked_out_by_name, items: d.damage, total: damageTotal(d.damage) }));
  const today = lagosDay(new Date().toISOString());
  const justReady = readiness
    .filter((r) => r.status === "ready" && r.lastPrep && lagosDay(r.lastPrep.at) === today)
    .sort((a, b) => b.lastPrep!.at.localeCompare(a.lastPrep!.at))
    .map((r) => ({ name: r.apartment.name, type: r.apartment.type, at: clockTime(r.lastPrep!.at), by: r.lastPrep!.by }));
  return (
    <FrontDeskClient
      key={searchParams.apt ?? ""}
      initialApt={searchParams.apt ?? ""}
      apts={readiness.map((r) => toBoardApt(r, session.staffId))}
      justReady={justReady}
      readyDays={READY_DAYS}
      damage={<DamageCard bills={bills} canCharge={DD_CAN_CHARGE_DAMAGE.includes(session.role)} />}
    />
  );
}
