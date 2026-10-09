"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Banknote, Camera, Check, CheckCheck, ClipboardCheck, Inbox, MapPin, Plus, Receipt, RotateCcw, UserRound, Wrench } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Badge, priTone, stTone } from "@/components/suite";
import { FundBars, fundNote } from "@/components/fund-ui";
import { FUND_STAGE, TX_LABEL } from "@/lib/funding";
import { askedBy, stLabel, type JobView } from "@/lib/jobs";
import { shortDate } from "@/lib/periods";
import { MD_UNITS, formatNaira as naira } from "@/lib/types";
import { shrinkPhoto } from "@/lib/photo";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { addPhotoAction, assignUnitAction, getPhotosAction, markNoPurchaseAction, quickPurchaseAction, reopenAction, resolveWorkAction, startWorkAction, voidJobAction } from "@/app/(app)/jobs/actions";

const pad = (n: number) => String(n).padStart(2, "0");
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Today at the given time, in this device's time (the property's).
const todayAt = (hm: string) => { const [h, m] = hm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const tm = (when: string | null) => (when ? when.replace(/^Today /, "") : "");
const num = (v: string) => parseFloat(v.replace(/[^0-9.]/g, ""));

export interface Me {
  name: string;
  isTechnician: boolean;
  unit: string | null;
}

export function JobDrawer({
  job,
  onClose,
  team,
  me,
  canManage,
  canMoney,
  canWorkAny,
}: {
  job: JobView | null;
  onClose: () => void;
  team: Record<string, string[]>;
  me: Me;
  canManage: boolean;
  canMoney: boolean;
  canWorkAny: boolean; // may start and finish jobs at all (not Head of Operations)
}) {
  const router = useRouter();
  const [step, setStep] = useState<null | "start" | "resolve" | "void">(null);
  const [who, setWho] = useState("");
  const [at, setAt] = useState(nowHM());
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [buy, setBuy] = useState({ item: "", q: "1", u: "" });
  const [photos, setPhotos] = useState<{ id: string; urls: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);
  // The start, finish and void forms open near the top of the panel: bring them into view.
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (step) boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [step]);

  const id = job?.id;
  useEffect(() => { setStep(null); setError(null); setBuy({ item: "", q: "1", u: "" }); setReason(""); }, [id]);
  const photoCount = job?.photoCount ?? 0;
  useEffect(() => {
    if (!id || !photoCount) return setPhotos(null);
    let gone = false;
    callAction(getPhotosAction)(id).then((urls) => { if (!gone) setPhotos({ id, urls }); }).catch(() => {});
    return () => { gone = true; };
  }, [id, photoCount]);

  if (!job) return null;
  const crew = team[job.unit] ?? [];
  const mineToWork = canWorkAny && (canManage || (me.isTechnician && me.unit === job.unit));
  const si = ["Reported", "In Progress", "Resolved"].indexOf(job.status);

  const openStep = (s: "start" | "resolve") => {
    setStep(s);
    setError(null);
    setAt(nowHM());
    setNote("");
    setWho(me.isTechnician ? me.name : s === "resolve" && job.startedBy ? job.startedBy : crew[0] ?? "");
  };

  const run = (fn: () => Promise<void>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      try { await fn(); after?.(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); }
    });
  };

  const saveStep = () => {
    if (!who.trim()) return setError(step === "resolve" ? "Choose who fixed it." : "Choose who is doing it.");
    if (!/^\d{2}:\d{2}$/.test(at)) return setError("Give the time, like 14:30.");
    if (step === "resolve" && !note.trim()) return setError("Say what was done. Duty Desk sees this.");
    run(() => (step === "start" ? callAction(startWorkAction)(job.id, who, todayAt(at)) : callAction(resolveWorkAction)(job.id, who, todayAt(at), note)), () => setStep(null));
  };

  const addPhoto = (file: File | undefined) => {
    if (!file) return;
    run(async () => { const fd = new FormData(); fd.set("id", job.id); fd.set("photo", await shrinkPhoto(file)); await callAction(addPhotoAction)(fd); });
    if (photoRef.current) photoRef.current.value = "";
  };

  const f = job.funding, stage = job.fundStage;
  const fromChip = job.isRequest
    ? <span className="src req"><Inbox size={12} /> {job.requester?.role ?? "Request"}</span>
    : job.source === "checklist" ? <span className="src dd"><ClipboardCheck size={12} /> From check-in prep</span> : <span className="src dd">{job.fromLabel}</span>;

  const footer = step === "void" ? (
    <><button type="button" className="btn btn-ghost" onClick={() => setStep(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={() => run(() => callAction(voidJobAction)(job.id, reason), () => { setStep(null); onClose(); })}>{pending ? "Voiding…" : "Void job"}</button></>
  ) : (
    <>
      {canManage && !job.void ? <button type="button" className="btn btn-ghost" onClick={() => { setReason(""); setStep("void"); }}><Ban size={15} /> Void</button> : null}
      <span style={{ flex: 1 }} />
      {job.void ? <Badge tone="neu" dot={false}>Voided</Badge>
        : !mineToWork ? <span className="hint">{canWorkAny ? `Only ${job.unit}, the Manager or the Supervisor can work on this.` : `View only · ${job.status === "Resolved" ? "finished" : job.status === "In Progress" ? "being worked on" : "not started yet"}`}</span>
        : step ? null
        : (
          <>
            {si === 0 ? <button type="button" className="btn btn-secondary" disabled={pending || job.needsUnit} onClick={() => openStep("start")}>Start work</button> : null}
            {si < 2 ? <button type="button" className="btn btn-primary" disabled={pending || job.needsUnit} onClick={() => openStep("resolve")}><Check size={15} /> Resolve</button> : null}
            {si === 2 && canManage ? <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run(() => callAction(reopenAction)(job.id))}><RotateCcw size={14} /> Reopen</button> : null}
          </>
        )}
    </>
  );

  return (
    <Drawer open onClose={onClose} over={`${job.ref} · ${job.unit}`} title={job.title} footer={footer}>
      <div className="hstack" style={{ marginTop: -4 }}>
        <Badge tone={priTone(job.priority)}>{job.priority} priority</Badge>
        {job.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={stTone(job.status)}>{stLabel(job.status)}</Badge>}
        {fromChip}
        {job.blocksSale && job.status !== "Resolved" ? <Badge tone="bad">Stops the apartment being sold</Badge> : null}
      </div>
      {!job.void ? <div className="steps">{["Reported", "In progress", "Resolved"].map((s, i) => <div key={s} className={i <= si ? "done" : ""}>{s}</div>)}</div> : null}

      {job.requester ? (
        <div className="req-box">
          <span className="over">Request · not from Duty Desk</span>
          <b>{askedBy(job.requester)}</b>
          <span className="muted" style={{ fontSize: 12.5 }}>Asked {job.createdWhen}</span>
        </div>
      ) : null}

      {job.needsUnit ? (
        <div className="pill-note t-warn"><Wrench size={16} /><span>This job was filed under “{job.unit}” before the five units existed. {canManage ? "Choose the unit that will do it:" : "The Manager or Supervisor will choose the unit that does it."}</span></div>
      ) : null}
      {canManage && !job.void && job.status !== "Resolved" ? (
        <div className="field">
          <label htmlFor="jd-unit">Unit</label>
          <select className="input" id="jd-unit" value={job.needsUnit ? "" : job.unit} disabled={pending} onChange={(e) => e.target.value && run(() => callAction(assignUnitAction)(job.id, e.target.value))} style={{ maxWidth: 260 }}>
            {job.needsUnit ? <option value="">Choose a unit…</option> : null}
            {MD_UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      ) : null}

      {step === "start" || step === "resolve" ? (
        <div className="work-box" ref={boxRef}>
          <span className="over">{step === "resolve" ? "Finish the job" : "Start the job"}</span>
          <div className="hstack" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="jd-who">{step === "resolve" ? "Fixed by" : "Who is doing it"}</label>
              <input className="input" id="jd-who" list="jd-crew" value={who} onChange={(e) => setWho(e.target.value)} readOnly={me.isTechnician} autoComplete="off" placeholder={crew.length ? "" : "Type the technician’s name"} />
              <datalist id="jd-crew">{[...new Set([...crew, me.name])].map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="field" style={{ width: 120 }}>
              <label htmlFor="jd-at">{step === "resolve" ? "Finished at" : "Started at"}</label>
              <input className="input mono" id="jd-at" type="time" value={at} onChange={(e) => setAt(e.target.value)} />
            </div>
          </div>
          <span className="hint">{job.unit} · today</span>
          {step === "resolve" ? (
            <div className="field"><label htmlFor="jd-note">What was done <span className="muted">(Duty Desk sees this)</span></label><textarea className="input" id="jd-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Replaced the magnetron and tested it" /></div>
          ) : null}
          {error ? <div className="err-note" role="alert">{error}</div> : null}
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            {!job.isRequest ? <span className="hint"><CheckCheck size={13} style={{ verticalAlign: "-2px" }} /> Duty Desk is told who {step === "resolve" ? "fixed it" : "started"} and when.</span> : <span />}
            <span className="hstack">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={saveStep}><Check size={14} /> {pending ? "Saving…" : step === "resolve" ? "Mark resolved" : "Start"}</button>
            </span>
          </div>
        </div>
      ) : null}

      {step === "void" ? (
        <div className="work-box" ref={boxRef}>
          <span className="over">Void this job</span>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>It stays on record, on Duty Desk too, marked voided with your reason. Use it for mistakes and duplicates.</p>
          <div className="field"><label htmlFor="jd-reason">Reason (required)</label><textarea className="input" id="jd-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate of MT-0040" /></div>
          {error ? <div className="err-note" role="alert">{error}</div> : null}
        </div>
      ) : null}

      {canMoney && !job.void ? (
        f ? (
          <div className="fund-box">
            <div className="hstack" style={{ justifyContent: "space-between" }}><span className="over">Money from Finance</span>{stage !== "none" ? <Badge tone={FUND_STAGE[stage].tone}>{FUND_STAGE[stage].label}</Badge> : null}</div>
            <FundBars f={f} spent={job.cost} />
            <p className="fund-note">{fundNote(f, stage, job.cost)}</p>
            {f.tx.filter((x) => !x.void).length ? (
              <ul className="fund-tx">
                {f.tx.filter((x) => !x.void).map((x) => (
                  <li key={x.id}><span className="mono">{shortDate(x.tx_date)}</span><span><b>{TX_LABEL[x.kind]}</b>{x.reference ? ` · ${x.reference}` : ""}{x.finance_officer ? ` · ${x.finance_officer}` : ""}{x.pays_back ? ` · pays back ${x.pays_back}` : ""}</span><b className={`mono ${x.kind === "return" ? "neg" : ""}`}>{x.kind === "return" ? "−" : ""}{naira(x.amount)}</b></li>
                ))}
              </ul>
            ) : null}
            {canManage ? <Link className="btn btn-secondary btn-sm" href={`/funding?job=${job.id}`} style={{ alignSelf: "flex-start" }}><Banknote size={14} /> Record money on Funding</Link> : null}
          </div>
        ) : canManage ? (
          <div className="fund-mini"><span><Banknote size={15} /> Need money from Finance for this job?</span><Link className="btn btn-secondary btn-sm" href={`/funding?job=${job.id}`}>Record money from Finance</Link></div>
        ) : null
      ) : null}

      <dl className="kv">
        <dt>{job.apartment ? "Apartment" : "Area"}</dt><dd><MapPin size={13} style={{ verticalAlign: "-2px" }} /> {job.area}{job.where ? <span className="muted"> · {job.where}</span> : null}</dd>
        <dt>Raised by</dt><dd>{job.raisedBy}</dd>
        <dt>Logged</dt><dd>{job.createdWhen}</dd>
        {job.startedBy ? <><dt>Started</dt><dd>{job.startedBy} · {job.startedWhen}</dd></> : null}
        {job.status === "Resolved" ? <><dt>Fixed by</dt><dd>{job.resolvedBy ? <><b>{job.resolvedBy}</b> · {job.unit} · {job.resolvedWhen}</> : <span className="muted">Not recorded (finished before this was tracked)</span>}</dd></> : null}
        {job.fixNote ? <><dt>What was done</dt><dd>{job.fixNote}</dd></> : null}
        {job.notes ? <><dt>Notes</dt><dd style={{ whiteSpace: "pre-line" }}>{job.notes}</dd></> : null}
        {job.void ? <><dt>Voided</dt><dd>{job.voidedBy} · {job.voidReason}</dd></> : null}
      </dl>

      {job.photoCount || (mineToWork && !job.void) ? (
        <div className="vstack" style={{ gap: 8 }}>
          <span className="over">Photos</span>
          <div className="photos">
            {photos?.id === job.id ? photos.urls.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i + 1} of ${job.title}`} /></a>) : job.photoCount ? <span className="hint">Loading {job.photoCount} photo{job.photoCount > 1 ? "s" : ""}…</span> : null}
            {mineToWork && !job.void ? (
              <label className="photo-add"><Camera size={16} /><span>Add photo</span><input ref={photoRef} type="file" accept="image/*" capture="environment" disabled={pending} onChange={(e) => addPhoto(e.target.files?.[0])} /></label>
            ) : null}
          </div>
        </div>
      ) : null}

      {canMoney ? (
        <div className="vstack" style={{ gap: 0 }}>
          <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}><span className="over">What was bought</span><b className="mono">{naira(job.cost)}</b></div>
          {job.lines.length ? job.lines.map((l) => (
            <div key={l.id} className="cost-row"><b style={{ fontWeight: 500 }}>{l.item}</b><b className="mono" style={{ fontWeight: 500 }}>{naira(l.line_total)}</b><span>{l.quantity} × {naira(l.unit_cost)}{l.supplier ? ` · ${l.supplier}` : ""} · {l.recorded_by_name}</span><span className="mono">{l.purchased_on}</span></div>
          )) : <div className="hint" style={{ padding: "8px 0" }}>{job.noPurchase ? "Marked “nothing needed buying”." : "Nothing recorded yet."}</div>}
          {canManage && !job.void ? (
            <div className="vstack" style={{ gap: 8, marginTop: 10, padding: 12, border: "1px dashed var(--line-strong)", borderRadius: 12 }}>
              <div className="field"><label htmlFor="jd-item">Item</label><input className="input" id="jd-item" value={buy.item} onChange={(e) => setBuy({ ...buy, item: e.target.value })} placeholder="e.g. Microwave magnetron" /></div>
              <div className="hstack" style={{ flexWrap: "nowrap" }}>
                <div className="field" style={{ width: 80 }}><label htmlFor="jd-q">Qty</label><input className="input mono" id="jd-q" inputMode="decimal" value={buy.q} onChange={(e) => setBuy({ ...buy, q: e.target.value })} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="jd-u">Unit cost (₦)</label><input className="input mono" id="jd-u" inputMode="decimal" value={buy.u} onChange={(e) => setBuy({ ...buy, u: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="hstack" style={{ justifyContent: "space-between" }}>
                {!job.lines.length && !job.noPurchase ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => callAction(markNoPurchaseAction)(job.id))}>Nothing needed buying</button> : <span />}
                <button type="button" className="btn btn-secondary btn-sm" disabled={pending || !buy.item.trim()} onClick={() => run(() => callAction(quickPurchaseAction)(job.id, buy.item, num(buy.q), num(buy.u)), () => setBuy({ item: "", q: "1", u: "" }))}><Plus size={14} /> Add purchase</button>
              </div>
            </div>
          ) : null}
          {canManage ? <Link className="link" href={`/costs?job=${job.id}`} style={{ marginTop: 8, alignSelf: "flex-start" }}><Receipt size={13} /> Several items or a supplier? Record them on Costs</Link> : null}
        </div>
      ) : null}

      {error && !step ? <div className="err-note" role="alert">{error}</div> : null}

      <div className="vstack">
        <span className="over">Activity</span>
        <ul className="tl" style={{ padding: 0 }}>
          <li><span className="tm">{tm(job.createdWhen)}</span><span className="dt">{job.isRequest ? <Inbox size={11} /> : <ClipboardCheck size={11} />}</span><span className="tx"><b>{job.raisedBy}</b> {job.isRequest ? "asked for this" : "raised it"}</span></li>
          {job.startedWhen ? <li><span className="tm">{tm(job.startedWhen)}</span><span className="dt"><UserRound size={11} /></span><span className="tx"><b>{job.startedBy}</b> started work</span></li> : null}
          {job.lines.map((l) => <li key={l.id}><span className="tm">{l.purchased_on.slice(5)}</span><span className="dt"><Receipt size={11} /></span><span className="tx">Bought {l.item} · {naira(l.line_total)}</span></li>)}
          {job.status === "Resolved" ? <li><span className="tm">{tm(job.resolvedWhen)}</span><span className="dt"><Check size={11} /></span><span className="tx">{job.resolvedBy ? <><b>{job.resolvedBy}</b> ({job.unit}) fixed it{job.fixNote ? `: ${job.fixNote}` : ""}</> : "Marked resolved"}</span></li> : null}
        </ul>
      </div>
    </Drawer>
  );
}
