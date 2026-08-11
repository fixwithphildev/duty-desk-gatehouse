import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT } from "@/lib/types";
import { getIncidents } from "@/lib/data/incidents";
import { IncidentsClient } from "./incidents-client";

export default async function IncidentsPage() {
  const session = await requirePageAccess("/incidents");
  const incidents = await getIncidents();
  return <IncidentsClient incidents={incidents} canEdit={GH_CAN_EDIT.includes(session.role)} />;
}
