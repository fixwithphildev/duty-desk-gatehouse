"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Search, X } from "lucide-react";
import { filterToQuery, isFiltered, matchesHistory, NO_FILTER, type HistoryFilter, type HistoryType, type Issue } from "@/lib/checklist-history";

export interface HistoryRow {
  id: string;
  apartment: string;
  type: string;
  typeKey: "in" | "out";
  by: string;
  when: string;
  // Lagos date, YYYY-MM-DD, for the date filter.
  day: string;
  ready: boolean;
  void: boolean;
  issues: Issue[];
}

const PAGE = 50;
const TYPES: [HistoryType, string][] = [["all", "All"], ["in", "Check-in preps"], ["out", "Check-out inspections"]];

const issueText = (i: Issue) => `${i.name} (${i.problem.toLowerCase()})`;

// Every submitted checklist, newest first: who did it, when, and what was wrong.
export function HistoryTable({ rows, initial }: { rows: HistoryRow[]; initial: HistoryFilter }) {
  const [f, setF] = useState<HistoryFilter>(initial);
  const [shown, setShown] = useState(PAGE);
  const set = (patch: Partial<HistoryFilter>) => { setF((prev) => ({ ...prev, ...patch })); setShown(PAGE); };

  // Keep the filters in the address, so a refresh or a shared link shows the same list.
  useEffect(() => {
    try { window.history.replaceState(window.history.state, "", `/checklists${filterToQuery(f)}`); } catch { /* not important */ }
  }, [f]);

  const list = rows.filter((r) => matchesHistory(r, f));
  const withIssues = rows.filter((r) => matchesHistory(r, { ...f, issues: true })).length;
  const filtered = isFiltered(f);

  return (
    <section className="card" id="history">
      <div className="card-h">
        <h3>Submitted checklists</h3><span className="sub">{list.length} of {rows.length}</span><span className="sp" />
        <a className="btn btn-secondary btn-sm" href={`/reports/export/checklists${filterToQuery(f)}`} download><Download size={14} /> {filtered ? "Export these" : "Export all"}</a>
      </div>
      <div className="st-tools">
        <div className="seg" role="group" aria-label="Checklist type">
          {TYPES.map(([t, l]) => <button key={t} type="button" aria-pressed={f.type === t} onClick={() => set({ type: t })}>{l}</button>)}
        </div>
        <label className="chk"><input type="checkbox" checked={f.issues} onChange={(e) => set({ issues: e.target.checked })} /> Only with issues <span className="mono muted">{withIssues}</span></label>
        <label className="hist-date">From <input type="date" className="input mono" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} aria-label="From date" /></label>
        <label className="hist-date">To <input type="date" className="input mono" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} aria-label="To date" /></label>
        <div className="input-wrap st-search">
          <Search size={15} />
          <input className="input" style={{ height: 36 }} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Apartment, officer or item" aria-label="Search submitted checklists" />
        </div>
        {filtered ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(NO_FILTER)}><X size={14} /> Clear</button> : null}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Apartment</th><th>Checklist</th><th>Prepared by</th><th>Submitted</th><th>Result</th><th>Issues</th><th className="r" /></tr></thead>
          <tbody>
            {list.slice(0, shown).map((r) => (
              <tr key={r.id} style={r.void ? { opacity: 0.6 } : undefined}>
                <td><b style={{ fontWeight: 600 }}>{r.apartment}</b></td>
                <td>{r.type}</td>
                <td>{r.by}</td>
                <td className="mono" style={{ color: "var(--text-3)" }}>{r.when}</td>
                <td>{r.void ? <span className="badge t-neu">Voided</span> : <span className={`badge ${r.ready ? "t-ok" : "t-bad"}`}><span className="d" />{r.ready ? "Ready" : "Not ready"}</span>}</td>
                <td className="hist-iss">
                  {r.issues.length ? (
                    <span title={r.issues.map((i) => `${issueText(i)}${i.note ? `: ${i.note}` : ""}`).join("\n")}>
                      <span className="badge t-bad">{r.issues.length} issue{r.issues.length === 1 ? "" : "s"}</span>{" "}
                      <span className="muted">{r.issues.slice(0, 2).map(issueText).join(", ")}{r.issues.length > 2 ? ` +${r.issues.length - 2} more` : ""}</span>
                    </span>
                  ) : <span className="muted">None</span>}
                </td>
                <td className="r"><Link href={`/checklists/${r.id}`} className="btn btn-ghost btn-sm">View</Link></td>
              </tr>
            ))}
            {list.length === 0 ? <tr><td colSpan={7} className="empty">{rows.length ? "No checklists match these filters." : "No checklists submitted yet."}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {list.length > shown ? <div style={{ padding: "12px 20px" }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => setShown((n) => n + PAGE)}>Show more</button></div> : null}
    </section>
  );
}
