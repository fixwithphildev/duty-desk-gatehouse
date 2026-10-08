import { requirePageAccess } from "@/lib/auth";
import { MD_MANAGE_ROLES } from "@/lib/types";
import { getDesk } from "@/lib/data/desk";
import { missingCost } from "@/lib/jobs";
import { lagosToday, shortDate, thisMonth, thisWeek } from "@/lib/periods";
import { CostsClient, type Purchase, type JobOption } from "./costs-client";

export default async function CostsPage({ searchParams }: { searchParams: { job?: string; unit?: string } }) {
  const session = await requirePageAccess("/costs");
  const { jobs, expenses } = await getDesk();
  const byId = new Map(jobs.map((j) => [j.id, j]));

  const purchases: Purchase[] = expenses.map((e) => {
    const job = e.ticket_id ? byId.get(e.ticket_id) : undefined;
    return {
      id: e.id,
      date: e.purchased_on,
      dateText: shortDate(e.purchased_on),
      unit: e.unit ?? job?.unit ?? "—",
      item: e.item,
      quantity: e.quantity,
      unitCost: e.unit_cost,
      total: e.line_total,
      supplier: e.supplier,
      jobId: e.ticket_id,
      jobRef: job?.ref ?? null,
      jobArea: job?.area ?? null,
      isRequest: job?.isRequest ?? false,
      recordedBy: e.recorded_by_name,
    };
  });

  const options: JobOption[] = jobs
    .filter((j) => !j.void)
    .map((j) => ({ id: j.id, ref: j.ref, title: j.title, area: j.area, unit: j.unit, status: j.status, isRequest: j.isRequest, requester: j.requester?.name ?? null, spent: j.cost, released: j.funding ? j.funding.tx.filter((x) => !x.void).reduce((a, x) => a + (x.kind === "return" ? -x.amount : x.amount), 0) : null, need: j.funding?.need ?? null, old: j.status === "Resolved" && !!j.resolvedAt && Date.now() - new Date(j.resolvedAt).getTime() > 45 * 86400000 }));

  const missing = jobs.filter(missingCost).map((j) => ({ id: j.id, ref: j.ref, title: j.title, area: j.area, unit: j.unit }));
  const prefill = searchParams.job ? jobs.find((j) => j.id === searchParams.job) : undefined;

  return (
    <CostsClient
      purchases={purchases}
      options={options}
      missing={missing}
      canManage={MD_MANAGE_ROLES.includes(session.role)}
      me={session.displayName}
      today={lagosToday()}
      week={thisWeek()}
      month={thisMonth()}
      initialUnit={searchParams.unit ?? prefill?.unit ?? "all"}
      initialJob={prefill ? prefill.id : ""}
    />
  );
}
