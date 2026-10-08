import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_COMPLAINTS, DD_CAN_VOID } from "@/lib/types";
import { getComplaints } from "@/lib/data/complaints";
import { findApartment } from "@/lib/apartments";
import { ageText, whenText } from "@/lib/time";
import { ComplaintsClient, type ComplaintView } from "./complaint-client";

export default async function ComplaintsPage({ searchParams }: { searchParams: { id?: string; apt?: string } }) {
  const session = await requirePageAccess("/complaints");
  const complaints = await getComplaints();
  const views: ComplaintView[] = complaints.map((c) => ({
    ...c,
    apartment: findApartment(c.room)?.name ?? c.room ?? "",
    loggedWhen: whenText(c.created_at),
    age: ageText(c.created_at),
    progressWhen: c.in_progress_at ? whenText(c.in_progress_at) : null,
    resolvedWhen: c.resolved_at ? whenText(c.resolved_at) : null,
    voidedWhen: c.voided_at ? whenText(c.voided_at) : null,
  }));
  return (
    <ComplaintsClient
      complaints={views}
      initialId={searchParams.id ?? null}
      initialApartment={searchParams.apt ?? ""}
      canEdit={DD_CAN_EDIT_COMPLAINTS.includes(session.role)}
      canVoid={DD_CAN_VOID.includes(session.role)}
      me={session.displayName}
    />
  );
}
