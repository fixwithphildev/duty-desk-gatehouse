import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT } from "@/lib/types";
import { getPatrols } from "@/lib/data/patrols";
import { PatrolsClient } from "./patrols-client";

export default async function PatrolsPage() {
  const session = await requirePageAccess("/patrols");
  const patrols = await getPatrols();
  return <PatrolsClient patrols={patrols} canEdit={GH_CAN_EDIT.includes(session.role)} />;
}
