import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { getAlerts } from "@/lib/data/alerts";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage() {
  const session = await requirePageAccess("/alerts");
  const alerts = await getAlerts();
  return (
    <AlertsClient
      alerts={alerts}
      canEdit={GH_CAN_EDIT.includes(session.role)}
      canVoid={GH_CAN_VOID.includes(session.role)}
    />
  );
}
