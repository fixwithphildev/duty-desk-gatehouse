import { requirePageAccess } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { FUND_STAGE, TX_LABEL, fundNet } from "@/lib/funding";
import { csvResponse, toCsv } from "@/lib/csv";
import { lagosToday } from "@/lib/periods";

// Finance statement: every payment from (or back to) Finance, by job, with
// what each job needed and spent. Opens in Excel or Google Sheets.
export async function GET() {
  await requirePageAccess("/funding");
  const { jobs } = await getDesk();
  const rows: Record<string, unknown>[] = [];
  for (const j of jobs.filter((x) => x.funding && !x.void)) {
    const f = j.funding!;
    const base = { ref: j.ref, job: j.title, unit: j.unit, area: j.area, needed: f.need, released: fundNet(f), spent: j.cost, stage: j.fundStage === "none" ? "" : FUND_STAGE[j.fundStage].label };
    const live = f.tx.filter((x) => !x.void);
    if (!live.length) rows.push({ ...base, date: "", type: "Nothing released yet", amount: "", reference: "", officer: "", paysBack: "" });
    for (const x of live) rows.push({ ...base, date: x.tx_date, type: TX_LABEL[x.kind], amount: x.kind === "return" ? -x.amount : x.amount, reference: x.reference ?? "", officer: x.finance_officer ?? "", paysBack: x.pays_back ?? "" });
  }
  const csv = toCsv(rows, [
    { key: "ref", label: "Job" },
    { key: "job", label: "What" },
    { key: "unit", label: "Unit" },
    { key: "area", label: "Area" },
    { key: "date", label: "Date" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "reference", label: "Reference" },
    { key: "officer", label: "Finance officer" },
    { key: "paysBack", label: "Pays back" },
    { key: "needed", label: "Needed (NGN)" },
    { key: "released", label: "Released so far (NGN)" },
    { key: "spent", label: "Spent (NGN)" },
    { key: "stage", label: "Status" },
  ]);
  return csvResponse(csv, `maintenance-finance-statement-${lagosToday()}.csv`);
}
