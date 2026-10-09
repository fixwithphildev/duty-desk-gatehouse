import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { GateClient } from "./gate-client";

export default async function GatePage({ searchParams }: { searchParams: { card?: string } }) {
  const session = await requireSession();
  const { out, recent, rackSize } = await getDesk();
  return (
    <GateClient
      out={out}
      recent={recent}
      rackSize={rackSize}
      now={Date.now()}
      initialCard={searchParams.card ?? null}
      canEdit={GH_CAN_EDIT.includes(session.role)}
      canVoid={GH_CAN_VOID.includes(session.role)}
      isAdmin={session.role === "super_admin"}
    />
  );
}
