import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { getVehicleLogs } from "@/lib/data/vehicles";
import { VehiclesClient } from "./vehicles-client";

export default async function VehiclesPage() {
  const session = await requirePageAccess("/vehicles");
  const logs = await getVehicleLogs();
  return (
    <VehiclesClient
      logs={logs}
      canEdit={GH_CAN_EDIT.includes(session.role)}
      canVoid={GH_CAN_VOID.includes(session.role)}
    />
  );
}
