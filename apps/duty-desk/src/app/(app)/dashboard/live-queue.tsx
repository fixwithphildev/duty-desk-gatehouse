"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, priTone, stTone } from "@/components/suite";

export interface QueueItem {
  kind: "c" | "t";
  id: string;
  title: string;
  meta: string;
  pri: string;
  status: string;
  age: string;
  href: string;
}

const RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

// Open complaints and maintenance, most urgent first.
export function LiveQueue({ items }: { items: QueueItem[] }) {
  const [tab, setTab] = useState<"all" | "c" | "t">("all");
  const sorted = [...items].sort((a, b) => (RANK[a.pri] ?? 3) - (RANK[b.pri] ?? 3));
  const list = sorted.filter((x) => tab === "all" || x.kind === tab);
  const nc = items.filter((x) => x.kind === "c").length;
  return (
    <section className="card">
      <div className="card-h" style={{ paddingBottom: 0, borderBottom: 0 }}><h3>Live queue</h3><span className="sp" /><span className="sub">most urgent first</span></div>
      <div className="tabs" role="tablist">
        {([["all", "All", items.length], ["c", "Complaints", nc], ["t", "Maintenance", items.length - nc]] as const).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{n}</span></button>
        ))}
      </div>
      <ul className="list">
        {list.slice(0, 6).map((x) => (
          <li key={`${x.kind}-${x.id}`}>
            <Link href={x.href} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
              <span className={`stripe s-${priTone(x.pri)}`} />
              <div className="m"><b>{x.title}</b><span className="mono">{x.meta}</span></div>
              <Badge tone={stTone(x.status)}>{x.status === "In Progress" ? "In progress" : x.status}</Badge>
              <span className="age">{x.age}</span>
            </Link>
          </li>
        ))}
        {list.length === 0 ? <li className="empty">Nothing open. All clear.</li> : null}
      </ul>
      {list.length > 6 ? (
        <div style={{ padding: "10px 20px 14px" }}><Link href={tab === "t" ? "/maintenance" : "/complaints"} className="link">See all {list.length} <ArrowRight size={12} /></Link></div>
      ) : null}
    </section>
  );
}
