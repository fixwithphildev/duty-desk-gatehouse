"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export interface HistoryRow {
  id: string;
  apartment: string;
  type: string;
  by: string;
  when: string;
  ready: boolean;
  void: boolean;
}

const PAGE = 50;

// Every submitted checklist, newest first, with a search box.
export function HistoryTable({ rows, initialQuery }: { rows: HistoryRow[]; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [shown, setShown] = useState(PAGE);
  const s = q.trim().toLowerCase();
  const list = rows.filter((r) => !s || `${r.apartment} ${r.by} ${r.type}`.toLowerCase().includes(s));

  return (
    <section className="card">
      <div className="card-h">
        <h3>Submitted checklists</h3><span className="sub">{list.length} of {rows.length}</span><span className="sp" />
        <div className="input-wrap" style={{ width: 260, maxWidth: "100%" }}>
          <Search size={15} />
          <input className="input" style={{ height: 36 }} value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search apartment or name" aria-label="Search submitted checklists" />
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Apartment</th><th>Checklist</th><th>Prepared by</th><th>Submitted</th><th>Result</th><th className="r" /></tr></thead>
          <tbody>
            {list.slice(0, shown).map((r) => (
              <tr key={r.id} style={r.void ? { opacity: 0.6 } : undefined}>
                <td><b style={{ fontWeight: 600 }}>{r.apartment}</b></td>
                <td>{r.type}</td>
                <td>{r.by}</td>
                <td className="mono" style={{ color: "var(--text-3)" }}>{r.when}</td>
                <td>{r.void ? <span className="badge t-neu">Voided</span> : <span className={`badge ${r.ready ? "t-ok" : "t-bad"}`}><span className="d" />{r.ready ? "Ready" : "Not ready"}</span>}</td>
                <td className="r"><Link href={`/checklists/${r.id}`} className="btn btn-ghost btn-sm">View</Link></td>
              </tr>
            ))}
            {list.length === 0 ? <tr><td colSpan={6} className="empty">{rows.length ? "No checklists match." : "No checklists submitted yet."}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {list.length > shown ? <div style={{ padding: "12px 20px" }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => setShown((n) => n + PAGE)}>Show more</button></div> : null}
    </section>
  );
}
