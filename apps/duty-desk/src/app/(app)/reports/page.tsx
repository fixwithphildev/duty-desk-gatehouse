import { DoorOpen, DoorClosed, MessageSquareWarning, Wrench } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getLatestSubmittedByApartment } from "@/lib/data/checklists";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { StatCard } from "@/components/ui";

export default async function ReportsPage() {
  await requirePageAccess("/reports");
  const [apts, complaints, tickets] = await Promise.all([getLatestSubmittedByApartment(), getComplaints(), getMaintenanceTickets()]);
  const ready = apts.filter((c) => c.overall_ready).length;

  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Apartments Ready" value={ready} icon={DoorOpen} tone="teal" />
        <StatCard label="Apartments Not Ready" value={apts.length - ready} icon={DoorClosed} tone={apts.length - ready ? "red" : "teal"} />
        <StatCard label="Complaints logged" value={complaints.length} icon={MessageSquareWarning} />
        <StatCard label="Tickets logged" value={tickets.length} icon={Wrench} />
      </div>
      <div className="card">
        <div className="card-head"><span>Complaints by status</span></div>
        <div className="stat-grid">
          {(["Open", "In Progress", "Resolved"] as const).map((status) => (
            <StatCard key={status} label={status} value={complaints.filter((c) => c.status === status).length} icon={MessageSquareWarning} />
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span>Maintenance tickets by status</span></div>
        <div className="stat-grid">
          {(["Reported", "In Progress", "Resolved"] as const).map((status) => (
            <StatCard key={status} label={status} value={tickets.filter((t) => t.status === status).length} icon={Wrench} />
          ))}
        </div>
      </div>
    </div>
  );
}
