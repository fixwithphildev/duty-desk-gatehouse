import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_COMPLAINTS } from "@/lib/types";
import { getComplaints } from "@/lib/data/complaints";
import { ComplaintsClient } from "./complaint-client";

export default async function ComplaintsPage() {
  const session = await requirePageAccess("/complaints");
  const complaints = await getComplaints();
  return <ComplaintsClient complaints={complaints} canEdit={DD_CAN_EDIT_COMPLAINTS.includes(session.role)} />;
}
