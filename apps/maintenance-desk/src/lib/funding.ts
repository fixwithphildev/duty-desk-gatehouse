// Money from Finance for one job. Finance often releases part up front and the
// rest when the job is done; units can spend ahead of what's been released (on
// credit or out of pocket). This works out where each job stands.

export type TxKind = "advance" | "balance" | "return";

export interface FundingTx {
  id: string;
  kind: TxKind;
  amount: number;
  tx_date: string; // YYYY-MM-DD
  reference: string | null;
  finance_officer: string | null;
  pays_back: string | null;
  recorded_by_name: string;
  void: boolean;
}

export interface Funding {
  need: number;
  balanceRequestedAt: string | null;
  balanceRequestedAmount: number | null;
  tx: FundingTx[];
}

export type FundStage = "none" | "waiting" | "part" | "full" | "balance-due" | "balance-requested" | "return-due" | "settled";

export const FUND_STAGE: Record<Exclude<FundStage, "none">, { tone: "ok" | "warn" | "bad" | "info"; label: string }> = {
  waiting: { tone: "warn", label: "Waiting for Finance" },
  part: { tone: "info", label: "Part-funded" },
  full: { tone: "ok", label: "Fully funded" },
  "balance-due": { tone: "bad", label: "Finance owes the balance" },
  "balance-requested": { tone: "warn", label: "Balance requested" },
  "return-due": { tone: "warn", label: "Return to Finance" },
  settled: { tone: "ok", label: "Settled" },
};

export const TX_LABEL: Record<TxKind, string> = { advance: "Released up front", balance: "Balance paid", return: "Returned to Finance" };

const live = (f: Funding | null) => (f ? f.tx.filter((x) => !x.void) : []);
export const fundIn = (f: Funding | null) => live(f).filter((x) => x.kind !== "return").reduce((a, x) => a + x.amount, 0);
export const fundBack = (f: Funding | null) => live(f).filter((x) => x.kind === "return").reduce((a, x) => a + x.amount, 0);
export const fundNet = (f: Funding | null) => fundIn(f) - fundBack(f);
// > 0: Finance owes the unit; < 0: the unit gives money back.
export const fundDiff = (f: Funding | null, spent: number) => spent - fundNet(f);
export const fundPct = (f: Funding | null) => (f && f.need ? Math.round((fundNet(f) / f.need) * 100) : 0);

export function fundStage(f: Funding | null, done: boolean, spent: number): FundStage {
  if (!f) return "none";
  const net = fundNet(f);
  if (!done) return net <= 0 ? "waiting" : net < f.need ? "part" : "full";
  const d = spent - net;
  if (d > 0) return f.balanceRequestedAt ? "balance-requested" : "balance-due";
  return d < 0 ? "return-due" : "settled";
}
