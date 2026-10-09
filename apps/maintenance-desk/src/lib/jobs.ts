import type { Funding, FundStage } from "./funding";

// One job as every Maintenance Desk page shows it: a Duty Desk ticket (the
// Ticket Board) or a request. Plain data, so it can go to the browser.
export interface CostLine {
  id: string;
  item: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  supplier: string | null;
  purchased_on: string;
  recorded_by_name: string;
}

export interface JobView {
  id: string;
  ref: string; // MT-0042
  title: string;
  area: string;
  apartment: string | null;
  where: string | null;
  unit: string;
  needsUnit: boolean; // filed as "Engineering" before the units existed
  priority: "Low" | "Medium" | "High";
  status: "Reported" | "In Progress" | "Resolved";
  source: string;
  isRequest: boolean;
  fromLabel: string;
  raisedBy: string;
  requester: { name: string; role: string; unit: string | null } | null;
  notes: string | null;
  createdAt: string;
  createdWhen: string;
  age: string;
  startedBy: string | null;
  startedAt: string | null;
  startedWhen: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolvedWhen: string | null;
  resolvedToday: boolean;
  // Finished since the redesign, when the finish time started being recorded (older jobs predate Costs).
  finishRecorded: boolean;
  fixNote: string | null;
  blocksSale: boolean;
  photoCount: number;
  cost: number;
  lines: CostLine[];
  noPurchase: boolean;
  funding: Funding | null;
  fundStage: FundStage;
  void: boolean;
  voidReason: string | null;
  voidedBy: string | null;
}

export const PRI_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
export const stLabel = (s: string) => (s === "In Progress" ? "In progress" : s);

// Done with nothing recorded on Costs: the unit still has to add what it bought, or mark "nothing bought".
// Jobs finished before the redesign are left out: Costs didn't exist for most of them.
export const missingCost = (j: JobView) => !j.void && j.status === "Resolved" && j.finishRecorded && j.lines.length === 0 && !j.noPurchase;

// Who asked for a request: "Mrs. Funke Okoye (COO)", or just "Head of Security" when the name is the role.
export function askedBy(r: JobView["requester"]): string {
  if (!r) return "";
  const what = r.unit ? `${r.unit}, maintenance` : r.role;
  return what && what !== r.name ? `${r.name} (${what})` : r.name;
}
