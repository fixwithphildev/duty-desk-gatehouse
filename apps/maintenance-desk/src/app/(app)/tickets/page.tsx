import { redirect } from "next/navigation";

// The old Tickets page is now the Ticket Board.
export default function TicketsPage({ searchParams }: { searchParams: { id?: string } }) {
  redirect(searchParams.id ? `/board?id=${encodeURIComponent(searchParams.id)}` : "/board");
}
