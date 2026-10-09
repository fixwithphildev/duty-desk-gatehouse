import type { ReactNode } from "react";
import { fundDiff, fundNet, fundPct, type Funding, type FundStage } from "@/lib/funding";
import { formatNaira as naira } from "@/lib/types";

// Released, spent and needed, side by side on one scale.
export function FundBars({ f, spent }: { f: Funding; spent: number }) {
  const net = fundNet(f), scale = Math.max(1, f.need, spent, net);
  const bar = (label: string, v: number, color: string) => (
    <div><span>{label}</span><span className="fb"><span style={{ width: `${(v / scale) * 100}%`, background: color }} /></span><b className="mono">{naira(v)}</b></div>
  );
  return (
    <div className="fund-bars">
      {bar("Released", net, "var(--acc)")}
      {bar("Spent", spent, spent > net ? "var(--warn)" : "var(--ok)")}
      {bar("Needed", f.need, "var(--neu)")}
    </div>
  );
}

// What the numbers mean, in a sentence.
export function fundNote(f: Funding, stage: FundStage, spent: number): ReactNode {
  const net = fundNet(f), d = fundDiff(f, spent), rest = f.need - net;
  switch (stage) {
    case "waiting":
      return "Nothing released yet. Record the money when Finance gives it.";
    case "part":
      return (
        <>
          Finance has released {fundPct(f)}%. The rest, {naira(Math.max(0, rest))}, comes when the job is done.
          {spent > net ? <> <b>{naira(spent - net)} has been spent beyond what was released</b> (on credit or out of pocket); it’s covered when the balance comes.</> : null}
        </>
      );
    case "full":
      return "Finance has released the full amount.";
    case "balance-due":
      return <>Job done. Spent {naira(spent)}, Finance released {naira(net)}, so <b>Finance owes {naira(d)}</b>. Request the balance.</>;
    case "balance-requested":
      return <>Balance of <b>{naira(d)}</b> requested from Finance. Waiting for payment.</>;
    case "return-due":
      return <>Job done for less than was released. <b>Return {naira(-d)} to Finance.</b></>;
    case "settled":
      return "All settled with Finance: what was released matches what was spent.";
    default:
      return null;
  }
}
