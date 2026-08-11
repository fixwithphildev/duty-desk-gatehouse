import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_RESIDENTS } from "@/lib/types";
import { getResidents } from "@/lib/data/residents";
import { ResidentsClient } from "./residents-client";

export default async function ResidentsPage() {
  const session = await requirePageAccess("/residents");
  const residents = await getResidents();
  return <ResidentsClient residents={residents} canEdit={DD_CAN_EDIT_RESIDENTS.includes(session.role)} />;
}
