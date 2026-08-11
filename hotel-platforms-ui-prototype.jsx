import { useState, useMemo } from "react";
import {
  LayoutDashboard, ClipboardCheck, MessageSquareWarning, Wrench, BookOpen,
  Users, ListTodo, FileBarChart, Plus, X, CheckCircle2, AlertTriangle,
  DoorClosed, DoorOpen, Home, Search, ClipboardList, Radio, Shield,
  KeyRound, Bell, AlertOctagon, Siren, LogOut, LogIn, UserCheck, Trash2,
  ChevronLeft, MapPin
} from "lucide-react";

/* =================================================================
   Shared helpers & generic UI (theme-agnostic — styled by ancestor)
================================================================= */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const nowISO = (offsetMin = 0) => new Date(Date.now() - offsetMin * 60000).toISOString();
const fmtTime = (iso) => !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function useMockCollection(initial) {
  const [items, setItems] = useState(initial);
  const add = (item) => { const withId = { id: uid(), createdAt: nowISO(), ...item }; setItems((prev) => [withId, ...prev]); return withId; };
  const addMany = (newItems) => { const withIds = newItems.map((it) => ({ id: uid(), createdAt: nowISO(), ...it })); setItems((prev) => [...withIds, ...prev]); };
  const update = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => setItems((prev) => prev.filter((it) => it.id !== id));
  return { items, add, addMany, update, remove };
}

function Badge({ tone = "neutral", children }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
function StatCard({ label, value, icon: Icon, tone = "neutral", sub }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}><Icon size={17} /></div>
      <div><div className="stat-value mono">{value}</div><div className="stat-label">{label}</div>{sub ? <div className="stat-sub">{sub}</div> : null}</div>
    </div>
  );
}
function EmptyState({ icon: Icon, title, hint }) {
  return <div className="empty-state"><Icon size={26} strokeWidth={1.5} /><div className="empty-title">{title}</div>{hint ? <div className="empty-hint">{hint}</div> : null}</div>;
}
function Field({ label, children }) { return <label className="field"><span className="field-label">{label}</span>{children}</label>; }
function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer">
        <div className="drawer-head"><span className="drawer-title">{title}</span><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

/* =================================================================
   DUTY DESK — Resident Officer platform
================================================================= */
const DD_QTY_ITEMS = new Set(["Frying Pan", "Pots", "Tea Cups", "Mugs", "Dinner Plates", "Soup Bowls", "Available Pillows", "Hangers"]);
const DD_CATEGORIES = [
  { key: "room", label: "Room & Living", kind: "condition", items: ["Bed Condition", "Apartment Fragrance", "Condition of the Couch", "TV Condition", "Available Pillows", "Curtains / Blinds", "AC Units Condition", "Balcony Condition"] },
  { key: "kitchen", label: "Kitchen & Dining", kind: "condition", items: ["Frying Pan", "Pots", "Tea Cups", "Mugs", "Dinner Plates", "Soup Bowls", "Gas Availability", "Refrigerator Condition"] },
  { key: "bathroom", label: "Bathroom", kind: "condition", items: ["Bath Robe", "Shower Heads", "Toilet Seats", "Taps"] },
  { key: "electronics", label: "Electronics & Remotes", kind: "yesno", items: ["TV Remotes", "A/C Remote (Bedroom)", "MiFi Available"] },
  { key: "toiletries", label: "Toiletries & Utilities", kind: "yesno", items: ["Tissue", "Body Towels", "Bottle Water Available"] },
];
const DD_ALL_ITEMS = DD_CATEGORIES.flatMap((c) => c.items.map((name) => ({ name, category: c.key, categoryLabel: c.label, kind: c.kind, hasQty: DD_QTY_ITEMS.has(name) })));
const DD_CHECKLIST_TYPES = ["Check-in Prep", "Check-out Inspection"];
const DD_CONDITIONS = ["Good", "Damaged", "Missing", "N/A"];
const DD_COMPLAINT_CATEGORIES = ["Noise", "Cleanliness", "Service", "Billing", "Other"];
const DD_PRIORITIES = ["Low", "Medium", "High"];
const DD_COMPLAINT_STATUSES = ["Open", "In Progress", "Resolved"];
const DD_TICKET_DEPTS = ["Engineering", "Housekeeping", "General Maintenance"];
const DD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"];

const DD_USER = { name: "A. Bello", role: "Resident Officer" };

function ddPriorityTone(p) { return p === "High" ? "red" : p === "Medium" ? "gold" : "teal"; }
function ddConditionTone(c) { return c === "Good" ? "teal" : (c === "Damaged" || c === "Missing") ? "red" : "neutral"; }

function ddSeed() {
  const items12b = DD_ALL_ITEMS.map((it) => ({
    name: it.name, category: it.categoryLabel, kind: it.kind,
    qty: it.hasQty ? "2" : null,
    condition: it.kind === "condition" ? (it.name === "AC Units Condition" ? "Damaged" : "Good") : null,
    available: it.kind === "yesno" ? "Yes" : null,
  }));
  const items08a = DD_ALL_ITEMS.map((it) => ({
    name: it.name, category: it.categoryLabel, kind: it.kind,
    qty: it.hasQty ? "2" : null,
    condition: it.kind === "condition" ? "Good" : null,
    available: it.kind === "yesno" ? "Yes" : null,
  }));
  return {
    checklists: [
      { id: "c1", createdAt: nowISO(40), apartment: "12B", type: "Check-in Prep", preparedBy: "A. Bello", status: "Submitted", overallReady: false, items: items12b },
      { id: "c2", createdAt: nowISO(200), apartment: "08A", type: "Check-out Inspection", preparedBy: "T. Musa", status: "Submitted", overallReady: true, items: items08a },
    ],
    complaints: [
      { id: "cp1", createdAt: nowISO(60), guestName: "Mrs. Adeyemi", room: "05C", category: "Noise", priority: "Medium", description: "Loud music from neighboring unit after 11pm", status: "Open" },
      { id: "cp2", createdAt: nowISO(300), guestName: "Mr. Okon", room: "08A", category: "Service", priority: "Low", description: "Requested extra towels, not delivered yet", status: "Resolved" },
    ],
    tickets: [
      { id: "t1", createdAt: nowISO(38), area: "Apartment 12B", issueType: "AC Units Condition", assignedTo: "Engineering", priority: "Medium", status: "Reported", source: "checklist", notes: "Flagged as Damaged during Check-in Prep checklist" },
      { id: "t2", createdAt: nowISO(180), area: "Apartment 03B", issueType: "Leaking kitchen tap", assignedTo: "General Maintenance", priority: "Low", status: "In Progress", source: "manual" },
    ],
    dutyLogs: [
      { id: "d1", createdAt: nowISO(15), officer: "A. Bello", notes: "Quiet shift so far. 12B AC flagged, engineering notified. Front desk aware unit is not ready.", handover: true },
      { id: "d2", createdAt: nowISO(400), officer: "T. Musa", notes: "08A checked out and inspected clean, ready for next guest.", handover: false },
    ],
    residents: [
      { id: "r1", name: "Mr. Chen", room: "14C", checkIn: "2026-07-10", checkOut: "2026-08-10", preferences: "High floor, quiet side, extra pillows" },
    ],
    tasks: [
      { id: "tk1", description: "Restock toiletries in 06B before 3pm check-in", assignedTo: "Housekeeping", dueTime: "3:00 PM", status: "Pending" },
      { id: "tk2", description: "Confirm 12B AC repair completion with Engineering", assignedTo: "A. Bello", dueTime: "Today", status: "Pending" },
    ],
  };
}

function DDDashboard({ data, goTo }) {
  const apts = useMemo(() => {
    const map = {};
    data.checklists.items.forEach((c) => { if (c.status !== "Submitted") return; const k = c.apartment.toLowerCase(); if (!map[k] || new Date(c.createdAt) > new Date(map[k].createdAt)) map[k] = c; });
    return Object.values(map);
  }, [data.checklists.items]);
  const notReady = apts.filter((c) => !c.overallReady);
  const openComplaints = data.complaints.items.filter((c) => c.status !== "Resolved");
  const openTickets = data.tickets.items.filter((t) => t.status !== "Resolved");
  const pendingTasks = data.tasks.items.filter((t) => t.status !== "Done");
  const lastHandover = data.dutyLogs.items.find((d) => d.handover);

  return (
    <div className="view">
      <div className="view-head"><h2>Today's Duty Overview</h2><span className="mono view-time">{new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span></div>
      {lastHandover ? (
        <div className="handover-banner"><BookOpen size={16} /><div><div className="handover-title">Last shift handover — {lastHandover.officer}, {fmtTime(lastHandover.createdAt)}</div><div className="handover-note">{lastHandover.notes}</div></div></div>
      ) : null}
      <div className="stat-grid">
        <StatCard label="Apartments checked" value={apts.length} icon={ClipboardCheck} />
        <StatCard label="Not ready" value={notReady.length} icon={DoorClosed} tone={notReady.length ? "red" : "teal"} />
        <StatCard label="Open complaints" value={openComplaints.length} icon={MessageSquareWarning} tone={openComplaints.length ? "gold" : "teal"} />
        <StatCard label="Open maintenance" value={openTickets.length} icon={Wrench} tone={openTickets.length ? "gold" : "teal"} />
        <StatCard label="Pending tasks" value={pendingTasks.length} icon={ListTodo} />
      </div>
      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Apartments not ready for check-in</span></div>
          {notReady.length === 0 ? <EmptyState icon={DoorOpen} title="All checked apartments are ready" /> : (
            <ul className="feed">
              {notReady.map((c) => (
                <li key={c.id} className="feed-row" onClick={() => goTo("checklists")}>
                  <span className="feed-dot tone-red" />
                  <div className="feed-main"><div className="feed-label">Apartment {c.apartment}</div><div className="feed-meta mono">{c.preparedBy} · {fmtTime(c.createdAt)}</div></div>
                  <Badge tone="red">Not Ready</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head"><span>Recent activity</span></div>
          <ul className="feed">
            {[...data.complaints.items, ...data.tickets.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map((f) => (
              <li key={f.id} className="feed-row"><span className={`feed-dot tone-${f.priority ? ddPriorityTone(f.priority) : "neutral"}`} /><div className="feed-main"><div className="feed-label">{f.description || f.issueType}</div><div className="feed-meta mono">{fmtTime(f.createdAt)}</div></div></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DDChecklists({ col, ticketsCol }) {
  const [mode, setMode] = useState("list");
  const [viewing, setViewing] = useState(null);
  const [lookup, setLookup] = useState("");
  const apts = useMemo(() => {
    const map = {};
    col.items.forEach((c) => { if (c.status !== "Submitted") return; const k = c.apartment.toLowerCase(); if (!map[k] || new Date(c.createdAt) > new Date(map[k].createdAt)) map[k] = c; });
    return map;
  }, [col.items]);
  const lookupResult = lookup.trim() ? apts[lookup.trim().toLowerCase()] : null;

  if (mode === "new") return <DDNewChecklist onCancel={() => setMode("list")} onSubmit={(checklist, tickets) => { col.add(checklist); if (tickets.length) ticketsCol.addMany(tickets); setMode("list"); }} />;
  if (mode === "view" && viewing) return <DDViewChecklist checklist={viewing} onBack={() => setMode("list")} />;

  return (
    <div className="view">
      <div className="view-head"><h2>Apartment Readiness Checklists</h2><button className="btn btn-primary" onClick={() => setMode("new")}><Plus size={15} /> New checklist</button></div>
      <div className="card gate-card">
        <div className="card-head"><span>Front desk check-in gate</span></div>
        <p className="gate-copy">Enter an apartment number to confirm it's ready before check-in.</p>
        <div className="gate-search"><Search size={15} /><input className="input input-plain" placeholder="e.g. 12B" value={lookup} onChange={(e) => setLookup(e.target.value)} /></div>
        {lookup.trim() ? (lookupResult ? (
          <div className={`gate-result tone-${lookupResult.overallReady ? "teal" : "red"}`}>{lookupResult.overallReady ? <DoorOpen size={18} /> : <DoorClosed size={18} />}<div><div className="gate-status">{lookupResult.overallReady ? "READY for check-in" : "NOT READY — check-in blocked"}</div><div className="gate-meta mono">Last checked by {lookupResult.preparedBy} · {fmtTime(lookupResult.createdAt)}</div></div></div>
        ) : <div className="gate-result tone-neutral"><DoorClosed size={18} /><div className="gate-status">No submitted checklist found — check-in blocked</div></div>) : null}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Apartment</th><th>Type</th><th>Prepared by</th><th>Date</th><th>Ready</th><th /></tr></thead>
          <tbody>
            {col.items.map((c) => (
              <tr key={c.id}>
                <td className="cell-title">{c.apartment}</td><td>{c.type}</td><td>{c.preparedBy}</td><td className="mono">{fmtTime(c.createdAt)}</td>
                <td><Badge tone={c.overallReady ? "teal" : "red"}>{c.overallReady ? "Ready" : "Not Ready"}</Badge></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => { setViewing(c); setMode("view"); }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DDNewChecklist({ onCancel, onSubmit }) {
  const [apartment, setApartment] = useState("");
  const [type, setType] = useState(DD_CHECKLIST_TYPES[0]);
  const [values, setValues] = useState({});
  const setVal = (name, patch) => setValues((v) => ({ ...v, [name]: { ...v[name], ...patch } }));
  const flaggedCount = Object.values(values).filter((v) => v.condition === "Damaged" || v.condition === "Missing").length;
  const answeredCount = Object.keys(values).filter((k) => values[k].condition || values[k].available).length;

  const handleSubmit = () => {
    const items = DD_ALL_ITEMS.map((it) => {
      const v = values[it.name] || {};
      return { name: it.name, category: it.categoryLabel, kind: it.kind, qty: it.hasQty ? (v.qty || "") : null, condition: it.kind === "condition" ? (v.condition || "N/A") : null, available: it.kind === "yesno" ? (v.available || "No") : null };
    });
    const overallReady = !items.some((i) => i.condition === "Damaged" || i.condition === "Missing");
    const checklist = { apartment: apartment.trim(), type, preparedBy: DD_USER.name, status: "Submitted", overallReady, items };
    const tickets = items.filter((i) => i.condition === "Damaged" || i.condition === "Missing").map((i) => ({ area: `Apartment ${apartment.trim()}`, issueType: i.name, assignedTo: "Engineering", priority: i.condition === "Missing" ? "High" : "Medium", status: "Reported", source: "checklist", notes: `Flagged as ${i.condition} during ${type} checklist` }));
    onSubmit(checklist, tickets);
  };

  return (
    <div className="view">
      <div className="view-head"><h2>New Checklist</h2><button className="btn btn-ghost" onClick={onCancel}><X size={14} /> Cancel</button></div>
      <div className="card">
        <div className="new-header-grid">
          <Field label="Apartment / unit number"><input className="input" value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="e.g. 12B" /></Field>
          <Field label="Checklist type"><div className="seg">{DD_CHECKLIST_TYPES.map((t) => <button key={t} className={`seg-btn ${type === t ? "seg-active" : ""}`} onClick={() => setType(t)}>{t}</button>)}</div></Field>
          <Field label="Prepared by"><input className="input" value={DD_USER.name} disabled /></Field>
        </div>
        <div className="progress-row mono">
          <span>{answeredCount} / {DD_ALL_ITEMS.length} items checked</span>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${(answeredCount / DD_ALL_ITEMS.length) * 100}%`, background: flaggedCount > 0 ? "var(--red)" : "var(--teal)" }} /></div>
          {flaggedCount > 0 ? <span className="progress-flag">{flaggedCount} flagged</span> : null}
        </div>
      </div>
      {DD_CATEGORIES.map((cat) => (
        <div className="card" key={cat.key}>
          <div className="card-head"><span>{cat.label}</span></div>
          <div className="checklist-grid">
            {cat.items.map((name) => {
              const item = DD_ALL_ITEMS.find((i) => i.name === name);
              const v = values[name] || {};
              return (
                <div key={name} className="checklist-row">
                  <span className="checklist-name">{name}</span>
                  <div className="checklist-controls">
                    {item.hasQty ? <input className="input input-qty" type="number" min="0" placeholder="Qty" value={v.qty || ""} onChange={(e) => setVal(name, { qty: e.target.value })} /> : null}
                    {cat.kind === "condition" ? (
                      <div className="seg seg-tight">{DD_CONDITIONS.map((c) => <button key={c} className={`seg-btn seg-xs tone-${ddConditionTone(c)} ${v.condition === c ? "seg-active" : ""}`} onClick={() => setVal(name, { condition: c })}>{c}</button>)}</div>
                    ) : (
                      <div className="seg seg-tight">{["Yes", "No"].map((c) => <button key={c} className={`seg-btn seg-xs ${v.available === c ? "seg-active" : ""}`} onClick={() => setVal(name, { available: c })}>{c}</button>)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="submit-bar"><div className="mono submit-summary">{flaggedCount > 0 ? `${flaggedCount} item(s) will open maintenance tickets automatically.` : "No issues flagged — apartment will be marked Ready."}</div><button className="btn btn-primary" disabled={!apartment.trim()} onClick={handleSubmit}>Submit checklist &amp; lock</button></div>
    </div>
  );
}

function DDViewChecklist({ checklist, onBack }) {
  const flagged = checklist.items.filter((i) => i.condition === "Damaged" || i.condition === "Missing");
  return (
    <div className="view">
      <div className="view-head"><button className="btn btn-ghost" onClick={onBack}><ChevronLeft size={14} /> Back</button></div>
      <div className="card">
        <div className="view-checklist-head"><div><h2>Apartment {checklist.apartment}</h2><div className="mono cell-sub">{checklist.type} · prepared by {checklist.preparedBy} · {fmtTime(checklist.createdAt)}</div></div><Badge tone={checklist.overallReady ? "teal" : "red"}>{checklist.overallReady ? "Ready" : "Not Ready"}</Badge></div>
      </div>
      {flagged.length > 0 ? (
        <div className="card"><div className="card-head"><span>Flagged items</span></div>
          <ul className="feed">{flagged.map((i, idx) => <li key={idx} className="feed-row"><span className="feed-dot tone-red" /><div className="feed-main"><div className="feed-label">{i.name}</div><div className="feed-meta">{i.category}</div></div><Badge tone="red">{i.condition}</Badge></li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function DDComplaints({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { guestName: "", room: "", category: DD_COMPLAINT_CATEGORIES[0], priority: "Medium", description: "" };
  const [form, setForm] = useState(empty);
  const submit = () => { if (!form.description.trim()) return; col.add({ ...form, status: "Open" }); setForm(empty); setOpen(false); };
  return (
    <div className="view">
      <div className="view-head"><h2>Guest &amp; Resident Complaints</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log complaint</button></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Logged</th><th>Guest</th><th>Room</th><th>Category</th><th>Priority</th><th>Details</th><th>Status</th></tr></thead>
        <tbody>{col.items.map((c) => (
          <tr key={c.id}><td className="mono">{fmtTime(c.createdAt)}</td><td>{c.guestName || "—"}</td><td>{c.room || "—"}</td><td>{c.category}</td><td><Badge tone={ddPriorityTone(c.priority)}>{c.priority}</Badge></td><td className="cell-sub">{c.description}</td>
            <td><select className="select select-sm" value={c.status} onChange={(e) => col.update(c.id, { status: e.target.value })}>{DD_COMPLAINT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>
        ))}</tbody>
      </table></div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Log a complaint / request">
        <Field label="Guest / resident name"><input className="input" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></Field>
        <Field label="Room / apartment"><input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
        <Field label="Category"><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{DD_COMPLAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Priority"><div className="seg">{DD_PRIORITIES.map((p) => <button key={p} className={`seg-btn tone-${ddPriorityTone(p)} ${form.priority === p ? "seg-active" : ""}`} onClick={() => setForm({ ...form, priority: p })}>{p}</button>)}</div></Field>
        <Field label="Details"><textarea className="textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.description.trim()} onClick={submit}>Save</button>
      </Drawer>
    </div>
  );
}

function DDMaintenance({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { area: "", issueType: "", assignedTo: DD_TICKET_DEPTS[0], priority: "Medium" };
  const [form, setForm] = useState(empty);
  const submit = () => { if (!form.area.trim() || !form.issueType.trim()) return; col.add({ ...form, status: "Reported", source: "manual" }); setForm(empty); setOpen(false); };
  return (
    <div className="view">
      <div className="view-head"><h2>Maintenance Tickets</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New ticket</button></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Reported</th><th>Area</th><th>Issue</th><th>Assigned</th><th>Priority</th><th>Source</th><th>Status</th></tr></thead>
        <tbody>{col.items.map((t) => (
          <tr key={t.id}><td className="mono">{fmtTime(t.createdAt)}</td><td>{t.area}</td><td><div className="cell-title">{t.issueType}</div>{t.notes ? <div className="cell-sub">{t.notes}</div> : null}</td><td>{t.assignedTo}</td>
            <td><Badge tone={ddPriorityTone(t.priority)}>{t.priority}</Badge></td><td><Badge tone={t.source === "checklist" ? "gold" : "neutral"}>{t.source === "checklist" ? "Checklist" : "Manual"}</Badge></td>
            <td><select className="select select-sm" value={t.status} onChange={(e) => col.update(t.id, { status: e.target.value })}>{DD_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>
        ))}</tbody>
      </table></div>
      <Drawer open={open} onClose={() => setOpen(false)} title="New maintenance ticket">
        <Field label="Area / room"><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Apartment 12B" /></Field>
        <Field label="Issue"><input className="input" value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })} placeholder="e.g. Leaking tap" /></Field>
        <Field label="Assign to"><select className="select" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>{DD_TICKET_DEPTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Priority"><div className="seg">{DD_PRIORITIES.map((p) => <button key={p} className={`seg-btn tone-${ddPriorityTone(p)} ${form.priority === p ? "seg-active" : ""}`} onClick={() => setForm({ ...form, priority: p })}>{p}</button>)}</div></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.area.trim() || !form.issueType.trim()} onClick={submit}>Create ticket</button>
      </Drawer>
    </div>
  );
}

function DDDutyLog({ col }) {
  const [notes, setNotes] = useState(""); const [handover, setHandover] = useState(false);
  const submit = () => { if (!notes.trim()) return; col.add({ officer: DD_USER.name, notes: notes.trim(), handover }); setNotes(""); setHandover(false); };
  return (
    <div className="view">
      <div className="view-head"><h2>Duty Log</h2></div>
      <div className="card">
        <Field label="Log entry"><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened this shift" /></Field>
        <label className="checkbox-row"><input type="checkbox" checked={handover} onChange={(e) => setHandover(e.target.checked)} /><span>Mark as shift handover note</span></label>
        <button className="btn btn-primary" disabled={!notes.trim()} onClick={submit}>Add entry</button>
      </div>
      <ul className="feed feed-card">{col.items.map((d) => (
        <li key={d.id} className="feed-row feed-row-block"><span className={`feed-dot ${d.handover ? "tone-gold" : "tone-neutral"}`} /><div className="feed-main"><div className="feed-label">{d.notes}</div><div className="feed-meta mono">{d.officer} · {fmtTime(d.createdAt)} {d.handover ? "· Handover note" : ""}</div></div></li>
      ))}</ul>
    </div>
  );
}

function DDTasks({ col }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Tasks</h2></div>
      <ul className="feed feed-card">{col.items.map((t) => (
        <li key={t.id} className="feed-row"><span className={`feed-dot ${t.status === "Done" ? "tone-teal" : "tone-gold"}`} /><div className="feed-main"><div className="feed-label">{t.description}</div><div className="feed-meta mono">{t.assignedTo || "Unassigned"} {t.dueTime ? `· due ${t.dueTime}` : ""}</div></div>
          {t.status === "Pending" ? <button className="btn btn-ghost btn-sm" onClick={() => col.update(t.id, { status: "Done" })}><CheckCircle2 size={13} /> Done</button> : <Badge tone="teal">Done</Badge>}</li>
      ))}</ul>
    </div>
  );
}

function DDResidents({ col }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Resident Records</h2></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Preferences</th></tr></thead>
        <tbody>{col.items.map((r) => <tr key={r.id}><td className="cell-title">{r.name}</td><td>{r.room}</td><td>{r.checkIn}</td><td>{r.checkOut}</td><td className="cell-sub">{r.preferences}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

function DDReports({ data }) {
  const apts = useMemo(() => {
    const map = {};
    data.checklists.items.forEach((c) => { if (c.status !== "Submitted") return; const k = c.apartment.toLowerCase(); if (!map[k] || new Date(c.createdAt) > new Date(map[k].createdAt)) map[k] = c; });
    return Object.values(map);
  }, [data.checklists.items]);
  const ready = apts.filter((c) => c.overallReady).length;
  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Apartments Ready" value={ready} icon={DoorOpen} tone="teal" />
        <StatCard label="Apartments Not Ready" value={apts.length - ready} icon={DoorClosed} tone={apts.length - ready ? "red" : "teal"} />
        <StatCard label="Complaints logged" value={data.complaints.items.length} icon={MessageSquareWarning} />
        <StatCard label="Tickets logged" value={data.tickets.items.length} icon={Wrench} />
      </div>
    </div>
  );
}

const DD_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "checklists", label: "Checklists", icon: ClipboardCheck },
  { id: "complaints", label: "Complaints", icon: MessageSquareWarning },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "dutylog", label: "Duty Log", icon: BookOpen },
  { id: "residents", label: "Residents", icon: Users },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

function DutyDeskApp() {
  const [tab, setTab] = useState("dashboard");
  const seed = useMemo(ddSeed, []);
  const checklists = useMockCollection(seed.checklists);
  const complaints = useMockCollection(seed.complaints);
  const tickets = useMockCollection(seed.tickets);
  const dutyLogs = useMockCollection(seed.dutyLogs);
  const residents = useMockCollection(seed.residents);
  const tasks = useMockCollection(seed.tasks);
  const data = { checklists, complaints, tickets, dutyLogs, residents, tasks };
  const notReadyCount = useMemo(() => {
    const map = {};
    checklists.items.forEach((c) => { if (c.status !== "Submitted") return; const k = c.apartment.toLowerCase(); if (!map[k] || new Date(c.createdAt) > new Date(map[k].createdAt)) map[k] = c; });
    return Object.values(map).filter((c) => !c.overallReady).length;
  }, [checklists.items]);

  return (
    <div className="dd-root">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand"><Home size={17} /><span className="brand-text">DUTY DESK</span></div>
          <nav className="nav">{DD_NAV.map((n) => { const Icon = n.icon; const active = tab === n.id; return (
            <button key={n.id} className={`nav-item ${active ? "nav-active" : ""}`} onClick={() => setTab(n.id)}><Icon size={16} /><span>{n.label}</span>{n.id === "checklists" && notReadyCount > 0 ? <span className="nav-dot" /> : null}</button>
          ); })}</nav>
          <div className="sidebar-foot"><div className="user-chip"><div className="user-avatar mono">{DD_USER.name[0]}</div><div><div className="user-name">{DD_USER.name}</div><div className="user-role">{DD_USER.role}</div></div></div></div>
        </aside>
        <main className="main">
          {tab === "dashboard" && <DDDashboard data={data} goTo={setTab} />}
          {tab === "checklists" && <DDChecklists col={checklists} ticketsCol={tickets} />}
          {tab === "complaints" && <DDComplaints col={complaints} />}
          {tab === "maintenance" && <DDMaintenance col={tickets} />}
          {tab === "dutylog" && <DDDutyLog col={dutyLogs} />}
          {tab === "residents" && <DDResidents col={residents} />}
          {tab === "tasks" && <DDTasks col={tasks} />}
          {tab === "reports" && <DDReports data={data} />}
        </main>
      </div>
    </div>
  );
}

/* =================================================================
   GATEHOUSE — Security platform
================================================================= */
const GH_INCIDENT_CATEGORIES = ["Theft", "Disturbance", "Medical", "Trespassing", "Property Damage", "Other"];
const GH_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const GH_INCIDENT_STATUSES = ["Open", "In Progress", "Resolved"];
const GH_KEY_TYPES = ["Room Key", "Master Key", "Storage / Utility", "Server Room"];
const GH_ALERT_TYPES = ["Fire", "Medical Emergency", "Security Breach", "Lockdown"];
const GH_USER = { name: "J. Okafor", role: "Security Officer" };

function ghSeverityTone(s) { return s === "Low" ? "green" : s === "Medium" ? "amber" : s === "High" ? "orange" : "red"; }
function ghStatusTone(s) { return ["Resolved", "Returned", "Completed", "Checked Out", "Acknowledged"].includes(s) ? "green" : ["Open", "Issued", "In Progress", "Checked In"].includes(s) ? "amber" : "neutral"; }

function ghSeed() {
  return {
    incidents: [
      { id: "i1", createdAt: nowISO(25), title: "Unlocked storage door on 3rd floor", category: "Property Damage", severity: "Medium", location: "3rd floor storage", reportedBy: "J. Okafor", status: "In Progress" },
      { id: "i2", createdAt: nowISO(500), title: "Argument between guests in lobby", category: "Disturbance", severity: "Low", location: "Main lobby", reportedBy: "R. Musa", status: "Resolved" },
    ],
    patrols: [
      { id: "p1", createdAt: nowISO(45), officer: "J. Okafor", route: "Parking deck → East stairwell → Roof access", status: "In Progress", startedAt: nowISO(45), endedAt: null, notes: "" },
      { id: "p2", createdAt: nowISO(400), officer: "R. Musa", route: "Lobby → Pool deck → Gym", status: "Completed", startedAt: nowISO(430), endedAt: nowISO(400), notes: "All clear" },
    ],
    keys: [
      { id: "k1", createdAt: nowISO(70), keyType: "Master Key", area: "3rd floor", issuedTo: "Housekeeping Lead", issuedBy: "J. Okafor", issuedAt: nowISO(70), returnedAt: null, status: "Issued" },
      { id: "k2", createdAt: nowISO(500), keyType: "Server Room", area: "IT Closet", issuedTo: "FixIt Electrical Co.", issuedBy: "J. Okafor", issuedAt: nowISO(650), returnedAt: nowISO(600), status: "Returned" },
    ],
    vehicles: [
      { id: "v1", createdAt: nowISO(95), cardNumber: "C-014", plateNumber: "ABC-234-XY", driverName: "David Bassey", entryAt: nowISO(95), exitAt: null, status: "In", loggedBy: "J. Okafor" },
      { id: "v2", createdAt: nowISO(650), cardNumber: "C-009", plateNumber: "KJA-771-FT", driverName: "FixIt Electrical Co.", entryAt: nowISO(650), exitAt: nowISO(600), status: "Returned", loggedBy: "J. Okafor" },
    ],
    items: [
      { id: "it1", createdAt: nowISO(180), itemDesc: "Company laptop (Dell, tag #IT-042)", carriedBy: "R. Musa", authorizedBy: "IT Manager", outAt: nowISO(180), inAt: null, status: "Out" },
      { id: "it2", createdAt: nowISO(720), itemDesc: "Toolbox for AC repair", carriedBy: "FixIt Electrical Co.", authorizedBy: "Facilities", outAt: nowISO(720), inAt: nowISO(650), status: "Returned" },
    ],
    attendance: [
      { id: "at1", createdAt: nowISO(480), staffName: "J. Okafor", role: "Security Officer", inAt: nowISO(480), outAt: null, status: "Signed In" },
      { id: "at2", createdAt: nowISO(1440), staffName: "R. Musa", role: "Security Officer", inAt: nowISO(1440), outAt: nowISO(960), status: "Signed Out" },
    ],
    offDuty: [
      { id: "od1", createdAt: nowISO(200), staffName: "T. Musa", department: "Resident Officer", reason: "Picking up personal item from locker", inAt: nowISO(200), outAt: nowISO(180), status: "Signed Out" },
    ],
    alerts: [
      { id: "a1", createdAt: nowISO(20), type: "Security Breach", severity: "High", message: "Storage door found unlocked, investigating", location: "3rd floor", raisedBy: "J. Okafor", status: "Unacknowledged" },
      { id: "a2", createdAt: nowISO(700), type: "Fire", severity: "Critical", message: "False alarm — kitchen smoke detector, resolved", location: "Kitchen", raisedBy: "R. Musa", status: "Acknowledged", acknowledgedBy: "Supervisor" },
    ],
  };
}

function GHDashboard({ data, goTo }) {
  const openIncidents = data.incidents.items.filter((i) => i.status !== "Resolved");
  const vehiclesIn = data.vehicles.items.filter((v) => v.status === "In");
  const activePatrols = data.patrols.items.filter((p) => p.status === "In Progress");
  const issuedKeys = data.keys.items.filter((k) => k.status === "Issued");
  const openAlerts = data.alerts.items.filter((a) => a.status !== "Acknowledged");
  return (
    <div className="view">
      <div className="view-head"><h2>Shift Overview</h2><span className="mono view-time">{new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span></div>
      <div className="stat-grid">
        <StatCard label="Open incidents" value={openIncidents.length} icon={AlertTriangle} tone={openIncidents.length ? "amber" : "green"} />
        <StatCard label="Vehicles on property" value={vehiclesIn.length} icon={MapPin} sub="cards out" />
        <StatCard label="Patrols active" value={activePatrols.length} icon={Shield} />
        <StatCard label="Keys issued" value={issuedKeys.length} icon={KeyRound} />
        <StatCard label="Unacknowledged alerts" value={openAlerts.length} icon={Bell} tone={openAlerts.length ? "red" : "green"} />
      </div>
      <div className="dash-grid">
        <div className="card"><div className="card-head"><span>Critical &amp; unresolved</span></div>
          <ul className="feed">{openAlerts.map((a) => (
            <li key={a.id} className="feed-row" onClick={() => goTo("alerts")}><span className={`feed-dot tone-${ghSeverityTone(a.severity)}`} /><div className="feed-main"><div className="feed-label">{a.message}</div><div className="feed-meta mono">{a.type} · {a.location}</div></div><Badge tone={ghSeverityTone(a.severity)}>{a.severity}</Badge></li>
          ))}</ul>
        </div>
        <div className="card"><div className="card-head"><span>Activity feed</span></div>
          <ul className="feed">{[...data.incidents.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map((i) => (
            <li key={i.id} className="feed-row" onClick={() => goTo("incidents")}><span className={`feed-dot tone-${ghSeverityTone(i.severity)}`} /><div className="feed-main"><div className="feed-label">{i.title}</div><div className="feed-meta mono">{i.category} · {fmtTime(i.createdAt)}</div></div></li>
          ))}</ul>
        </div>
      </div>
    </div>
  );
}

function GHIncidents({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { title: "", category: GH_INCIDENT_CATEGORIES[0], severity: "Low", location: "", description: "" };
  const [form, setForm] = useState(empty);
  const submit = () => { if (!form.title.trim()) return; col.add({ ...form, status: "Open", reportedBy: GH_USER.name }); setForm(empty); setOpen(false); };
  return (
    <div className="view">
      <div className="view-head"><h2>Incidents</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log incident</button></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Reported</th><th>Title</th><th>Category</th><th>Severity</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>{col.items.map((i) => (
          <tr key={i.id}><td className="mono">{fmtTime(i.createdAt)}</td><td className="cell-title">{i.title}</td><td>{i.category}</td><td><Badge tone={ghSeverityTone(i.severity)}>{i.severity}</Badge></td><td>{i.location || "—"}</td>
            <td><select className="select select-sm" value={i.status} onChange={(e) => col.update(i.id, { status: e.target.value })}>{GH_INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>
        ))}</tbody>
      </table></div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Log an incident">
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Category"><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{GH_INCIDENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Severity"><div className="seg">{GH_SEVERITIES.map((s) => <button key={s} className={`seg-btn tone-${ghSeverityTone(s)} ${form.severity === s ? "seg-active" : ""}`} onClick={() => setForm({ ...form, severity: s })}>{s}</button>)}</div></Field>
        <Field label="Location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Details"><textarea className="textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.title.trim()} onClick={submit}>Save incident</button>
      </Drawer>
    </div>
  );
}

function GHPatrols({ col }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Patrols</h2></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Officer</th><th>Route</th><th>Started</th><th>Status</th><th /></tr></thead>
        <tbody>{col.items.map((p) => (
          <tr key={p.id}><td>{p.officer}</td><td>{p.route}</td><td className="mono">{fmtTime(p.startedAt)}</td><td><Badge tone={ghStatusTone(p.status)}>{p.status}</Badge></td>
            <td>{p.status === "In Progress" ? <button className="btn btn-ghost btn-sm" onClick={() => col.update(p.id, { status: "Completed", endedAt: nowISO() })}><CheckCircle2 size={13} /> Complete</button> : null}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function GHKeys({ col }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Access &amp; Keys</h2></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Type</th><th>Area</th><th>Issued to</th><th>Status</th><th /></tr></thead>
        <tbody>{col.items.map((k) => (
          <tr key={k.id}><td>{k.keyType}</td><td>{k.area}</td><td>{k.issuedTo}</td><td><Badge tone={ghStatusTone(k.status)}>{k.status}</Badge></td>
            <td>{k.status === "Issued" ? <button className="btn btn-ghost btn-sm" onClick={() => col.update(k.id, { status: "Returned", returnedAt: nowISO() })}><DoorOpen size={13} /> Return</button> : null}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function GHAlerts({ col }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Alerts</h2></div>
      <div className="alert-list">{col.items.map((a) => (
        <div key={a.id} className={`alert-card tone-${ghSeverityTone(a.severity)}`}><AlertOctagon size={18} />
          <div className="alert-main"><div className="alert-top"><span className="alert-type">{a.type}</span><Badge tone={ghSeverityTone(a.severity)}>{a.severity}</Badge></div><div className="alert-msg">{a.message}</div><div className="alert-meta mono">{a.location} · raised by {a.raisedBy} · {fmtTime(a.createdAt)}</div></div>
          {a.status !== "Acknowledged" ? <button className="btn btn-ghost btn-sm" onClick={() => col.update(a.id, { status: "Acknowledged", acknowledgedBy: GH_USER.name })}><CheckCircle2 size={13} /> Acknowledge</button> : <Badge tone="green">Acknowledged</Badge>}
        </div>
      ))}</div>
    </div>
  );
}

function GHVehicles({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { cardNumber: "", plateNumber: "", driverName: "" };
  const [form, setForm] = useState(empty);
  const onProperty = col.items.filter((v) => v.status === "In");
  const submit = () => {
    if (!form.cardNumber.trim() || !form.plateNumber.trim()) return;
    col.add({ ...form, status: "In", entryAt: nowISO(), exitAt: null });
    setForm(empty); setOpen(false);
  };
  return (
    <div className="view">
      <div className="view-head"><h2>Vehicle Access Log</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Issue card / log entry</button></div>
      <div className="card"><div className="card-head"><span>On property ({onProperty.length})</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Card #</th><th>Plate #</th><th>Driver</th><th>Entered</th><th /></tr></thead>
          <tbody>{onProperty.map((v) => (
            <tr key={v.id}><td className="cell-title mono">{v.cardNumber}</td><td className="mono">{v.plateNumber}</td><td>{v.driverName || "—"}</td><td className="mono">{fmtTime(v.entryAt)}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => col.update(v.id, { status: "Returned", exitAt: nowISO() })}><DoorOpen size={13} /> Card returned</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card"><div className="card-head"><span>History</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Card #</th><th>Plate #</th><th>Driver</th><th>Entered</th><th>Exited</th><th>Status</th></tr></thead>
          <tbody>{col.items.filter((v) => v.status !== "In").map((v) => (
            <tr key={v.id}><td className="cell-title mono">{v.cardNumber}</td><td className="mono">{v.plateNumber}</td><td>{v.driverName || "—"}</td><td className="mono">{fmtTime(v.entryAt)}</td><td className="mono">{fmtTime(v.exitAt)}</td><td><Badge tone={ghStatusTone(v.status)}>{v.status}</Badge></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Issue a vehicle card">
        <Field label="Card number"><input className="input" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} placeholder="e.g. C-021" /></Field>
        <Field label="Plate number"><input className="input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="e.g. ABC-123-XY" /></Field>
        <Field label="Driver / company"><input className="input" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} placeholder="Optional" /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.cardNumber.trim() || !form.plateNumber.trim()} onClick={submit}>Log entry &amp; issue card</button>
      </Drawer>
    </div>
  );
}

function GHItems({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { itemDesc: "", carriedBy: "", authorizedBy: "" };
  const [form, setForm] = useState(empty);
  const outItems = col.items.filter((i) => i.status === "Out");
  const submit = () => {
    if (!form.itemDesc.trim() || !form.carriedBy.trim()) return;
    col.add({ ...form, status: "Out", outAt: nowISO(), inAt: null });
    setForm(empty); setOpen(false);
  };
  return (
    <div className="view">
      <div className="view-head"><h2>Items Book</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log item out</button></div>
      <div className="card"><div className="card-head"><span>Currently out ({outItems.length})</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Carried by</th><th>Authorized by</th><th>Out since</th><th /></tr></thead>
          <tbody>{outItems.map((i) => (
            <tr key={i.id}><td className="cell-title">{i.itemDesc}</td><td>{i.carriedBy}</td><td>{i.authorizedBy || "—"}</td><td className="mono">{fmtTime(i.outAt)}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => col.update(i.id, { status: "Returned", inAt: nowISO() })}><DoorOpen size={13} /> Mark returned</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card"><div className="card-head"><span>History</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Carried by</th><th>Out</th><th>In</th><th>Status</th></tr></thead>
          <tbody>{col.items.filter((i) => i.status !== "Out").map((i) => (
            <tr key={i.id}><td>{i.itemDesc}</td><td>{i.carriedBy}</td><td className="mono">{fmtTime(i.outAt)}</td><td className="mono">{fmtTime(i.inAt)}</td><td><Badge tone={ghStatusTone(i.status)}>{i.status}</Badge></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Log an item out">
        <Field label="Item description"><input className="input" value={form.itemDesc} onChange={(e) => setForm({ ...form, itemDesc: e.target.value })} placeholder="e.g. Company laptop, tag #IT-042" /></Field>
        <Field label="Carried by"><input className="input" value={form.carriedBy} onChange={(e) => setForm({ ...form, carriedBy: e.target.value })} /></Field>
        <Field label="Authorized by"><input className="input" value={form.authorizedBy} onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })} placeholder="Optional" /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.itemDesc.trim() || !form.carriedBy.trim()} onClick={submit}>Log item out</button>
      </Drawer>
    </div>
  );
}

function GHAttendance({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { staffName: "", role: "Security Officer" };
  const [form, setForm] = useState(empty);
  const signedIn = col.items.filter((a) => a.status === "Signed In");
  const submit = () => {
    if (!form.staffName.trim()) return;
    col.add({ ...form, status: "Signed In", inAt: nowISO(), outAt: null });
    setForm(empty); setOpen(false);
  };
  return (
    <div className="view">
      <div className="view-head"><h2>Staff Attendance</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Sign in</button></div>
      <div className="card"><div className="card-head"><span>On duty now ({signedIn.length})</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Staff</th><th>Role</th><th>Signed in</th><th /></tr></thead>
          <tbody>{signedIn.map((a) => (
            <tr key={a.id}><td className="cell-title">{a.staffName}</td><td>{a.role}</td><td className="mono">{fmtTime(a.inAt)}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => col.update(a.id, { status: "Signed Out", outAt: nowISO() })}><LogOut size={13} /> Sign out</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card"><div className="card-head"><span>History</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Staff</th><th>Role</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
          <tbody>{col.items.filter((a) => a.status !== "Signed In").map((a) => (
            <tr key={a.id}><td>{a.staffName}</td><td>{a.role}</td><td className="mono">{fmtTime(a.inAt)}</td><td className="mono">{fmtTime(a.outAt)}</td><td><Badge tone={ghStatusTone(a.status)}>{a.status}</Badge></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Sign in">
        <Field label="Staff name"><input className="input" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} /></Field>
        <Field label="Role"><input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.staffName.trim()} onClick={submit}>Sign in</button>
      </Drawer>
    </div>
  );
}

function GHOffDuty({ col }) {
  const [open, setOpen] = useState(false);
  const empty = { staffName: "", department: "", reason: "" };
  const [form, setForm] = useState(empty);
  const onSite = col.items.filter((o) => o.status === "Signed In" || !o.outAt);
  const submit = () => {
    if (!form.staffName.trim()) return;
    col.add({ ...form, status: "Signed In", inAt: nowISO(), outAt: null });
    setForm(empty); setOpen(false);
  };
  return (
    <div className="view">
      <div className="view-head"><h2>Off-Duty Staff Attendance</h2><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log visit</button></div>
      <p className="gate-copy" style={{ marginTop: -8 }}>For staff visiting the property while off shift — kept separate from on-duty attendance.</p>
      <div className="card"><div className="card-head"><span>Currently on site ({onSite.length})</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Staff</th><th>Department</th><th>Reason</th><th>In</th><th /></tr></thead>
          <tbody>{onSite.map((o) => (
            <tr key={o.id}><td className="cell-title">{o.staffName}</td><td>{o.department || "—"}</td><td className="cell-sub">{o.reason || "—"}</td><td className="mono">{fmtTime(o.inAt)}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => col.update(o.id, { status: "Signed Out", outAt: nowISO() })}><LogOut size={13} /> Sign out</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card"><div className="card-head"><span>History</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Staff</th><th>Department</th><th>In</th><th>Out</th></tr></thead>
          <tbody>{col.items.filter((o) => o.status === "Signed Out" && o.outAt).map((o) => (
            <tr key={o.id}><td>{o.staffName}</td><td>{o.department || "—"}</td><td className="mono">{fmtTime(o.inAt)}</td><td className="mono">{fmtTime(o.outAt)}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Log an off-duty visit">
        <Field label="Staff name"><input className="input" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} /></Field>
        <Field label="Department"><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Resident Officer" /></Field>
        <Field label="Reason for visit"><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        <button className="btn btn-primary drawer-submit" disabled={!form.staffName.trim()} onClick={submit}>Log visit</button>
      </Drawer>
    </div>
  );
}

function GHReports({ data }) {
  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Total incidents" value={data.incidents.items.length} icon={AlertTriangle} />
        <StatCard label="Total patrols" value={data.patrols.items.length} icon={Shield} />
        <StatCard label="Keys issued" value={data.keys.items.filter((k) => k.status === "Issued").length} icon={KeyRound} />
        <StatCard label="Alerts raised" value={data.alerts.items.length} icon={Bell} />
      </div>
    </div>
  );
}

const GH_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "vehicles", label: "Vehicle Access", icon: MapPin },
  { id: "items", label: "Items Book", icon: ClipboardList },
  { id: "attendance", label: "Staff Attendance", icon: UserCheck },
  { id: "offduty", label: "Off-Duty Attendance", icon: Users },
  { id: "patrols", label: "Patrols", icon: Shield },
  { id: "keys", label: "Access & Keys", icon: KeyRound },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

function GatehouseApp() {
  const [tab, setTab] = useState("dashboard");
  const seed = useMemo(ghSeed, []);
  const incidents = useMockCollection(seed.incidents);
  const vehicles = useMockCollection(seed.vehicles);
  const items = useMockCollection(seed.items);
  const attendance = useMockCollection(seed.attendance);
  const offDuty = useMockCollection(seed.offDuty);
  const patrols = useMockCollection(seed.patrols);
  const keys = useMockCollection(seed.keys);
  const alerts = useMockCollection(seed.alerts);
  const data = { incidents, vehicles, items, attendance, offDuty, patrols, keys, alerts };
  const unackCount = alerts.items.filter((a) => a.status !== "Acknowledged").length;

  return (
    <div className="gh-root">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand"><Radio size={18} /><span className="brand-text">GATEHOUSE</span></div>
          <nav className="nav">{GH_NAV.map((n) => { const Icon = n.icon; const active = tab === n.id; return (
            <button key={n.id} className={`nav-item ${active ? "nav-active" : ""}`} onClick={() => setTab(n.id)}><Icon size={16} /><span>{n.label}</span>{n.id === "alerts" && unackCount > 0 ? <span className="nav-dot" /> : null}</button>
          ); })}</nav>
          <div className="sidebar-foot"><div className="user-chip"><div className="user-avatar mono">{GH_USER.name[0]}</div><div><div className="user-name">{GH_USER.name}</div><div className="user-role">{GH_USER.role}</div></div></div></div>
        </aside>
        <main className="main">
          {tab === "dashboard" && <GHDashboard data={data} goTo={setTab} />}
          {tab === "incidents" && <GHIncidents col={incidents} />}
          {tab === "vehicles" && <GHVehicles col={vehicles} />}
          {tab === "items" && <GHItems col={items} />}
          {tab === "attendance" && <GHAttendance col={attendance} />}
          {tab === "offduty" && <GHOffDuty col={offDuty} />}
          {tab === "patrols" && <GHPatrols col={patrols} />}
          {tab === "keys" && <GHKeys col={keys} />}
          {tab === "alerts" && <GHAlerts col={alerts} />}
          {tab === "reports" && <GHReports data={data} />}
        </main>
      </div>
    </div>
  );
}

/* =================================================================
   Root — platform switcher + shared CSS for both themes
================================================================= */
export default function App() {
  const [platform, setPlatform] = useState("duty");
  return (
    <div className="proto-root">
      <ProtoStyles />
      <div className="proto-switcher">
        <span className="proto-switcher-label">Clickable prototype — no data is saved</span>
        <div className="proto-toggle">
          <button className={`proto-toggle-btn ${platform === "duty" ? "proto-toggle-active" : ""}`} onClick={() => setPlatform("duty")}>Duty Desk</button>
          <button className={`proto-toggle-btn ${platform === "gate" ? "proto-toggle-active" : ""}`} onClick={() => setPlatform("gate")}>Gatehouse</button>
        </div>
      </div>
      {platform === "duty" ? <DutyDeskApp /> : <GatehouseApp />}
    </div>
  );
}

function ProtoStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');

      .proto-root { font-family: 'Inter', sans-serif; --shadow-sm: 0 1px 2px rgba(20,18,14,0.06), 0 1px 1px rgba(20,18,14,0.04); --shadow-md: 0 4px 16px rgba(20,18,14,0.08), 0 1px 3px rgba(20,18,14,0.06); --shadow-lg: 0 12px 32px rgba(20,18,14,0.14); --ease: cubic-bezier(0.2, 0.7, 0.3, 1); }
      .proto-root *, .proto-root *::before, .proto-root *::after { transition-timing-function: var(--ease); }
      .proto-switcher { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 22px; background: #161616; border-bottom: 1px solid #2e2e2e; flex-wrap: wrap; }
      .proto-switcher-label { font-size: 11.5px; color: #8a8a8a; letter-spacing: 0.03em; font-weight: 500; }
      .proto-toggle { display: flex; gap: 3px; background: #232323; border-radius: 11px; padding: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3); }
      .proto-toggle-btn { border: none; background: transparent; color: #a8a8a8; font-size: 12.5px; font-weight: 600; padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: all 0.2s var(--ease); letter-spacing: 0.01em; }
      .proto-toggle-active { background: #fff; color: #161616; box-shadow: var(--shadow-sm); }

      /* ---- shared component classes (scoped inside either root) ---- */
      .gh-root, .dd-root { min-height: 100vh; width: 100%; }
      .gh-root *, .dd-root * { box-sizing: border-box; }
      .gh-root button, .dd-root button { font-family: inherit; cursor: pointer; }
      .gh-root select, .gh-root input, .gh-root textarea, .dd-root select, .dd-root input, .dd-root textarea { font-family: inherit; }
      .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }

      .app-shell { display: flex; min-height: 100vh; }
      .sidebar { width: 232px; flex-shrink: 0; display: flex; flex-direction: column; padding: 22px 14px; border-right: 1px solid var(--line); background: var(--panel, var(--surface)); }
      .brand { display: flex; align-items: center; gap: 9px; padding: 4px 10px 22px; }
      .brand-text { font-weight: 700; letter-spacing: 0.09em; font-size: 13px; }
      .nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
      .nav-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border: none; background: transparent; border-radius: 9px; font-size: 13.5px; text-align: left; position: relative; transition: background 0.18s var(--ease), color 0.18s var(--ease); }
      .nav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--red); margin-left: auto; box-shadow: 0 0 0 3px currentColor; opacity: 0.9; }
      .sidebar-foot { display: flex; align-items: center; gap: 9px; padding-top: 14px; margin-top: 4px; border-top: 1px solid var(--line); }
      .user-chip { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
      .user-avatar { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
      .user-name { font-size: 12.5px; font-weight: 600; }
      .user-role { font-size: 11px; opacity: 0.65; }

      .main { flex: 1; padding: 34px 40px 70px; overflow-x: hidden; min-width: 0; }
      .view { display: flex; flex-direction: column; gap: 22px; max-width: 1100px; animation: viewIn 0.25s var(--ease); }
      @keyframes viewIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .view-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .view-head h2 { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
      .view-time { font-size: 12px; opacity: 0.6; }

      .handover-banner { display: flex; gap: 12px; align-items: flex-start; border-radius: 14px; padding: 14px 16px; box-shadow: var(--shadow-sm); }
      .handover-title { font-size: 12.5px; font-weight: 600; margin-bottom: 3px; }
      .handover-note { font-size: 13px; line-height: 1.5; }

      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 14px; }
      .stat-card { border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: flex; gap: 12px; align-items: flex-start; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s var(--ease), transform 0.2s var(--ease); }
      .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
      .stat-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .stat-value { font-size: 22px; font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; }
      .stat-label { font-size: 12px; opacity: 0.65; margin-top: 3px; }
      .stat-sub { font-size: 10.5px; opacity: 0.55; }

      .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      @media (max-width: 860px) { .dash-grid { grid-template-columns: 1fr; } }

      .card { border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: var(--shadow-sm); }
      .card-head { font-size: 11.5px; font-weight: 700; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 14px; }
      .gate-card { border-color: var(--teal, var(--amber)); box-shadow: var(--shadow-md); }
      .gate-copy { font-size: 12.5px; opacity: 0.65; margin: -8px 0 12px; }
      .gate-search { display: flex; align-items: center; gap: 9px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; opacity: 0.9; transition: border-color 0.2s var(--ease); }
      .gate-search:focus-within { border-color: var(--teal, var(--amber)); }
      .input-plain { border: none; padding: 0; background: transparent; }
      .input-plain:focus { outline: none; }
      .gate-result { display: flex; gap: 11px; align-items: center; margin-top: 14px; padding: 14px 16px; border-radius: 12px; animation: viewIn 0.2s var(--ease); }
      .gate-status { font-weight: 700; font-size: 13.5px; }
      .gate-meta { font-size: 11px; opacity: 0.85; }

      .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .feed-card .feed-row { padding: 13px 4px; border-bottom: 1px solid var(--line); }
      .feed-card .feed-row:last-child { border-bottom: none; }
      .feed-row { display: flex; align-items: center; gap: 11px; padding: 10px 6px; border-radius: 9px; cursor: pointer; transition: background 0.15s var(--ease); }
      .feed-row-block { cursor: default; }
      .feed-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .feed-main { min-width: 0; flex: 1; }
      .feed-label { font-size: 13px; }
      .feed-meta { font-size: 10.5px; opacity: 0.6; margin-top: 2px; }

      .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 44px 16px; text-align: center; opacity: 0.7; }
      .empty-title { font-size: 13.5px; font-weight: 600; }
      .empty-hint { font-size: 12px; max-width: 300px; opacity: 0.8; line-height: 1.5; }

      .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; border: 1px solid var(--line); font-size: 13px; padding: 10px 16px; font-weight: 600; white-space: nowrap; background: var(--surface, transparent); transition: all 0.18s var(--ease); box-shadow: var(--shadow-sm); }
      .btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
      .btn:active { transform: translateY(0); }
      .btn-ghost { background: transparent; box-shadow: none; }
      .btn-ghost:hover { box-shadow: var(--shadow-sm); }
      .btn-sm { padding: 6px 12px; font-size: 12px; }
      .icon-btn { background: transparent; border: 1px solid var(--line); border-radius: 9px; padding: 7px; display: inline-flex; opacity: 0.7; transition: all 0.18s var(--ease); }
      .icon-btn:hover { opacity: 1; box-shadow: var(--shadow-sm); }

      .badge { font-size: 10.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; white-space: nowrap; letter-spacing: 0.01em; }

      .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-sm); }
      .table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.55; font-weight: 700; padding: 12px 16px; border-bottom: 1px solid var(--line); white-space: nowrap; }
      .table td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: top; transition: background 0.15s var(--ease); }
      .table tr:last-child td { border-bottom: none; }
      .table tbody tr:hover td { background: rgba(127,127,127,0.04); }
      .cell-title { font-weight: 600; }
      .cell-sub { font-size: 11.5px; opacity: 0.6; margin-top: 3px; max-width: 260px; line-height: 1.4; }
      .select-sm { padding: 5px 9px; font-size: 12px; }

      .alert-list { display: flex; flex-direction: column; gap: 12px; }
      .alert-card { display: flex; gap: 13px; align-items: flex-start; border: 1px solid var(--line); border-left: 3px solid var(--neutral); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s var(--ease); }
      .alert-card:hover { box-shadow: var(--shadow-md); }
      .alert-main { flex: 1; }
      .alert-top { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
      .alert-type { font-weight: 700; font-size: 13px; }
      .alert-msg { font-size: 13.5px; margin-bottom: 5px; line-height: 1.45; }
      .alert-meta { font-size: 11px; opacity: 0.6; }

      .field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }
      .field-label { font-size: 12px; opacity: 0.65; font-weight: 600; }
      .input, .select, .textarea { border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; font-size: 13.5px; width: 100%; background: var(--paper, transparent); transition: border-color 0.18s var(--ease), box-shadow 0.18s var(--ease); }
      .input:disabled { opacity: 0.55; }
      .textarea { resize: vertical; }
      .checkbox-row { display: flex; align-items: center; gap: 9px; font-size: 12.5px; opacity: 0.75; margin-bottom: 16px; }

      .seg { display: flex; gap: 7px; flex-wrap: wrap; }
      .seg-tight { gap: 5px; }
      .seg-btn { border: 1px solid var(--line); background: transparent; font-size: 12px; padding: 8px 13px; border-radius: 9px; opacity: 0.7; transition: all 0.15s var(--ease); font-weight: 500; }
      .seg-xs { padding: 5px 9px; font-size: 11px; }
      .seg-btn.seg-active { opacity: 1; font-weight: 700; box-shadow: var(--shadow-sm); }

      .drawer-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.45); display: flex; justify-content: flex-end; z-index: 50; backdrop-filter: blur(2px); animation: fadeIn 0.2s var(--ease); }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .drawer { width: 100%; max-width: 380px; height: 100%; border-left: 1px solid var(--line); padding: 22px 22px 30px; overflow-y: auto; background: var(--surface, #fff); box-shadow: var(--shadow-lg); animation: slideIn 0.25s var(--ease); }
      @keyframes slideIn { from { transform: translateX(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
      .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .drawer-title { font-weight: 700; font-size: 16.5px; }
      .drawer-submit { width: 100%; justify-content: center; margin-top: 6px; }

      .new-header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px 22px; margin-bottom: -4px; }
      @media (max-width: 720px) { .new-header-grid { grid-template-columns: 1fr; } }
      .progress-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; opacity: 0.7; padding-top: 6px; margin-top: 10px; gap: 12px; }
      .progress-flag { color: var(--red); font-weight: 700; opacity: 1; }
      .progress-track { flex: 1; height: 6px; border-radius: 6px; background: var(--line); overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 6px; transition: width 0.3s var(--ease); }

      .checklist-grid { display: flex; flex-direction: column; gap: 2px; }
      .checklist-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 6px; border-bottom: 1px solid var(--line); border-radius: 8px; transition: background 0.15s var(--ease); }
      .checklist-row:hover { background: rgba(127,127,127,0.04); }
      .checklist-row:last-child { border-bottom: none; }
      .checklist-name { font-size: 13px; flex: 1; font-weight: 500; }
      .checklist-controls { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
      .input-qty { width: 64px; padding: 7px 8px; font-size: 12px; text-align: center; }

      .submit-bar { position: sticky; bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--line); border-radius: 14px; padding: 16px 20px; background: var(--surface, #fff); box-shadow: var(--shadow-lg); }
      .submit-summary { font-size: 12px; opacity: 0.7; font-weight: 500; }
      .view-checklist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

      /* ---- Duty Desk theme tokens ---- */
      .dd-root {
        --paper: #F6F3EC; --surface: #FFFFFF; --ink: #2B2A26; --line: #E3DDCE; --muted: #8B8579;
        --teal: #2F6F62; --teal-soft: rgba(47,111,98,0.12); --gold: #B78B4B; --gold-soft: rgba(183,139,75,0.16);
        --red: #B4483F; --red-soft: rgba(180,72,63,0.13); --neutral: #C8C2B2;
        color: var(--ink); background: var(--paper);
      }
      .dd-root h1, .dd-root h2 { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
      .dd-root .brand { color: var(--teal); }
      .dd-root .brand-text { font-family: 'Fraunces', serif; }
      .dd-root .nav-item { color: var(--muted); }
      .dd-root .nav-item:hover { background: var(--paper); color: var(--ink); }
      .dd-root .nav-active { background: var(--teal-soft); color: var(--teal); font-weight: 700; }
      .dd-root .user-avatar { background: var(--teal-soft); color: var(--teal); }
      .dd-root .user-role { color: var(--muted); }
      .dd-root .stat-icon { background: var(--paper); }
      .dd-root .stat-card, .dd-root .card, .dd-root .table-wrap, .dd-root .alert-card { background: var(--surface); }
      .dd-root .stat-icon.tone-teal { background: var(--teal-soft); color: var(--teal); }
      .dd-root .stat-icon.tone-gold { background: var(--gold-soft); color: var(--gold); }
      .dd-root .stat-icon.tone-red { background: var(--red-soft); color: var(--red); }
      .dd-root .stat-label, .dd-root .stat-sub { color: var(--muted); }
      .dd-root .handover-banner { background: var(--gold-soft); border: 1px solid rgba(183,139,75,0.3); color: #6b4f26; }
      .dd-root .feed-dot { background: var(--neutral); }
      .dd-root .feed-dot.tone-teal { background: var(--teal); } .dd-root .feed-dot.tone-gold { background: var(--gold); } .dd-root .feed-dot.tone-red { background: var(--red); }
      .dd-root .feed-row:hover { background: var(--paper); }
      .dd-root .feed-meta { color: var(--muted); }
      .dd-root .empty-title { color: var(--ink); }
      .dd-root .empty-hint, .dd-root .empty-state { color: var(--muted); }
      .dd-root .btn { color: var(--ink); }
      .dd-root .btn-primary { background: var(--teal); color: #fff; border-color: var(--teal); }
      .dd-root .btn-primary:disabled { opacity: 0.4; }
      .dd-root .icon-btn { color: var(--muted); }
      .dd-root .badge-neutral { background: var(--paper); color: var(--muted); }
      .dd-root .badge-teal { background: var(--teal-soft); color: var(--teal); }
      .dd-root .badge-gold { background: var(--gold-soft); color: var(--gold); }
      .dd-root .badge-red { background: var(--red-soft); color: var(--red); }
      .dd-root .table th { background: var(--paper); color: var(--muted); }
      .dd-root .table td { background: var(--surface); }
      .dd-root .cell-sub { color: var(--muted); }
      .dd-root .field-label { color: var(--muted); }
      .dd-root .input:focus, .dd-root .select:focus, .dd-root .textarea:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-soft); }
      .dd-root .seg-btn.seg-active { border-color: currentColor; background: var(--surface); color: var(--ink); }
      .dd-root .seg-btn.tone-teal.seg-active { color: var(--teal); border-color: var(--teal); }
      .dd-root .seg-btn.tone-gold.seg-active { color: var(--gold); border-color: var(--gold); }
      .dd-root .seg-btn.tone-red.seg-active { color: var(--red); border-color: var(--red); }
      .dd-root .gate-result.tone-teal { background: var(--teal-soft); color: var(--teal); }
      .dd-root .gate-result.tone-red { background: var(--red-soft); color: var(--red); }
      .dd-root .gate-result.tone-neutral { background: var(--paper); color: var(--muted); }

      /* ---- Gatehouse theme tokens ---- */
      .gh-root {
        --ink: #edf1f4; --panel: #171f28; --surface: #171f28; --line: #2b3742; --muted: #8fa0ac;
        --amber: #e8a33d; --orange: #d9793d; --green: #4c9a76; --red: #d6524a; --neutral: #5c6b78;
        color: var(--ink); background: #10161d;
      }
      .gh-root h1, .gh-root h2 { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }
      .gh-root .brand { color: var(--amber); }
      .gh-root .brand-text { font-family: 'Space Grotesk', sans-serif; }
      .gh-root .nav-item { color: var(--muted); }
      .gh-root .nav-item:hover { background: #1d2731; color: var(--ink); }
      .gh-root .nav-active { background: #1d2731; color: var(--ink); font-weight: 700; }
      .gh-root .user-avatar { background: #354351; }
      .gh-root .user-role { color: var(--muted); }
      .gh-root .stat-icon { background: #2b3742; }
      .gh-root .stat-card, .gh-root .card, .gh-root .table-wrap, .gh-root .alert-card { background: #171f28; }
      .gh-root .stat-icon.tone-green { background: rgba(76,154,118,0.18); color: var(--green); }
      .gh-root .stat-icon.tone-amber { background: rgba(232,163,61,0.18); color: var(--amber); }
      .gh-root .stat-icon.tone-red { background: rgba(214,82,74,0.18); color: var(--red); }
      .gh-root .stat-label, .gh-root .stat-sub { color: var(--muted); }
      .gh-root .feed-dot { background: var(--neutral); }
      .gh-root .feed-dot.tone-green { background: var(--green); } .gh-root .feed-dot.tone-amber { background: var(--amber); } .gh-root .feed-dot.tone-orange { background: var(--orange); } .gh-root .feed-dot.tone-red { background: var(--red); }
      .gh-root .feed-row:hover { background: #1d2731; }
      .gh-root .feed-meta { color: var(--muted); }
      .gh-root .empty-title { color: var(--ink); }
      .gh-root .empty-hint, .gh-root .empty-state { color: var(--muted); }
      .gh-root .btn { color: var(--ink); background: #1d2731; }
      .gh-root .btn-primary { background: var(--amber); color: #1b1002; border-color: var(--amber); }
      .gh-root .btn-primary:disabled { opacity: 0.45; }
      .gh-root .icon-btn { color: var(--muted); }
      .gh-root .badge { background: #2b3742; color: var(--ink); }
      .gh-root .badge-neutral { background: #2b3742; color: var(--muted); }
      .gh-root .badge-green { background: rgba(76,154,118,0.18); color: var(--green); }
      .gh-root .badge-amber { background: rgba(232,163,61,0.18); color: var(--amber); }
      .gh-root .badge-orange { background: rgba(217,121,61,0.18); color: var(--orange); }
      .gh-root .badge-red { background: rgba(214,82,74,0.18); color: var(--red); }
      .gh-root .table th { background: #1d2731; color: var(--muted); }
      .gh-root .table td { background: #171f28; }
      .gh-root .cell-sub { color: var(--muted); }
      .gh-root .field-label { color: var(--muted); }
      .gh-root .input, .gh-root .select, .gh-root .textarea { background: #10161d; color: var(--ink); }
      .gh-root .input:focus, .gh-root .select:focus, .gh-root .textarea:focus { outline: none; border-color: var(--amber); box-shadow: 0 0 0 3px rgba(232,163,61,0.15); }
      .gh-root .seg-btn { background: #10161d; color: var(--muted); }
      .gh-root .seg-btn.seg-active { border-color: currentColor; background: #1d2731; color: var(--ink); }
      .gh-root .seg-btn.tone-green.seg-active { color: var(--green); } .gh-root .seg-btn.tone-amber.seg-active { color: var(--amber); } .gh-root .seg-btn.tone-orange.seg-active { color: var(--orange); } .gh-root .seg-btn.tone-red.seg-active { color: var(--red); }
    `}</style>
  );
}
