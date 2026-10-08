import { requireRole } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { StartChecklist } from "./start-checklist";

export default async function NewChecklistPage({ searchParams }: { searchParams: { apartment?: string } }) {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  return <StartChecklist preparedByName={session.displayName} initialApartment={searchParams.apartment ?? ""} />;
}
