import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_RESIDENTS, DD_CAN_VOID } from "@/lib/types";
import { getResidents } from "@/lib/data/residents";
import { getComplaints } from "@/lib/data/complaints";
import { getReadiness } from "@/lib/data/readiness";
import { aptWhere, findApartment } from "@/lib/apartments";
import { dayText, lagosDayKey, whenText } from "@/lib/time";
import { ResidentsClient, type ResidentView } from "./residents-client";

export default async function ResidentsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requirePageAccess("/residents");
  const [residents, complaints, readiness] = await Promise.all([getResidents(), getComplaints(), getReadiness()]);
  const today = lagosDayKey(new Date().toISOString());

  // Which record is the guest actually in each apartment right now (as the board sees it).
  const staying = new Set(readiness.map((r) => r.stay?.id).filter(Boolean) as string[]);
  const openComplaints = complaints.filter((c) => !c.void && c.status !== "Resolved");

  const views: ResidentView[] = residents.map((r) => {
    const apt = findApartment(r.room);
    const state: ResidentView["state"] = r.void ? "void" : r.checked_out_at ? "out" : staying.has(r.id) ? "in" : r.checked_in_at ? "out" : "record";
    return {
      ...r,
      apartment: apt?.name ?? r.room,
      where: apt ? aptWhere(apt) : "",
      state,
      leavesToday: state === "in" && !!r.check_out && r.check_out <= today,
      arrivedText: r.checked_in_at ? whenText(r.checked_in_at) : r.check_in ? dayText(r.check_in) : null,
      leavesText: r.checked_out_at ? whenText(r.checked_out_at) : r.check_out ? dayText(r.check_out) : null,
      chargedText: r.damage_charged_at ? whenText(r.damage_charged_at) : null,
      complaints: state === "in" ? openComplaints.filter((c) => findApartment(c.room)?.name === apt?.name).map((c) => ({ id: c.id, category: c.category, status: c.status, description: c.description })) : [],
    };
  });

  const readyApts = readiness.filter((r) => r.status === "ready").map((r) => ({ name: r.apartment.name, where: aptWhere(r.apartment) }));

  return (
    <ResidentsClient
      residents={views}
      readyApts={readyApts}
      initialId={searchParams.id ?? null}
      canEdit={DD_CAN_EDIT_RESIDENTS.includes(session.role)}
      canVoid={DD_CAN_VOID.includes(session.role)}
    />
  );
}
