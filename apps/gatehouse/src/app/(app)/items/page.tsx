import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { getItemLogs } from "@/lib/data/items";
import { ItemsClient } from "./items-client";

export default async function ItemsPage() {
  const session = await requirePageAccess("/items");
  const logs = await getItemLogs();
  return (
    <ItemsClient
      logs={logs}
      canEdit={GH_CAN_EDIT.includes(session.role)}
      canVoid={GH_CAN_VOID.includes(session.role)}
    />
  );
}
