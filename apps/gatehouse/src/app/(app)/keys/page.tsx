import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT } from "@/lib/types";
import { getKeyRecords } from "@/lib/data/keys";
import { KeysClient } from "./keys-client";

export default async function KeysPage() {
  const session = await requirePageAccess("/keys");
  const records = await getKeyRecords();
  return <KeysClient records={records} canEdit={GH_CAN_EDIT.includes(session.role)} />;
}
