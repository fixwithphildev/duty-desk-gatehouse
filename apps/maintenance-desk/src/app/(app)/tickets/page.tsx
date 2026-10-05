import { requireSession } from "@/lib/auth";
import { MD_CAN_EDIT_TICKETS, MD_CAN_VOID } from "@/lib/types";
import { getTickets } from "@/lib/data/tickets";
import { getCostInfoByTicket } from "@/lib/data/expenses";
import { TicketsClient } from "./tickets-client";

export default async function TicketsPage() {
  const session = await requireSession();
  const [tickets, costs] = await Promise.all([getTickets(), getCostInfoByTicket()]);
  return (
    <TicketsClient
      tickets={tickets}
      costs={costs}
      canEdit={MD_CAN_EDIT_TICKETS.includes(session.role)}
      canVoid={MD_CAN_VOID.includes(session.role)}
    />
  );
}
