"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { changeOwnUsercodeAction } from "./actions";
import { DD_ROLE_LABELS, type DDRole } from "@/lib/types";

export function AccountClient({ username, displayName, role, recent }: { username: string; displayName: string; role: DDRole; recent: { id: string; success: boolean; reason: string | null; when: string }[] }) {
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    if (!currentCode || !newCode || !confirmCode) return setError("Fill in all three boxes.");
    if (newCode.length < 6) return setError("The new usercode must be at least 6 characters.");
    if (newCode !== confirmCode) return setError("The two new usercodes don’t match.");
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await callAction(changeOwnUsercodeAction)({ currentCode, newCode, confirmCode });
        setCurrentCode("");
        setNewCode("");
        setConfirmCode("");
        setSuccess(true);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const type = show ? "text" : "password";
  return (
    <>
      <div className="phead">
        <div className="t"><h1>My account</h1><p>Your sign-in details. Keep your usercode to yourself; anyone who has it can sign in as you.</p></div>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Details</h3></div>
          <div className="card-b vstack" style={{ gap: 18 }}>
            <dl className="kv">
              <dt>Name</dt><dd>{displayName}</dd>
              <dt>Username</dt><dd className="mono">{username}</dd>
              <dt>Role</dt><dd>{DD_ROLE_LABELS[role]}</dd>
            </dl>
            <span className="hint">To change your name or role, ask the Admin (IT).</span>
            <hr className="sep" />
            <span className="over">Recent sign-ins</span>
            <ul className="list">
              {recent.map((e) => (
                <li key={e.id} className="row" style={{ padding: "8px 0" }}>
                  <span className={`stripe ${e.success ? "s-ok" : "s-bad"}`} />
                  <div className="m"><b style={{ fontWeight: 500 }}>{e.success ? "Signed in" : "Wrong usercode or blocked"}</b>{!e.success && e.reason ? <span>{e.reason}</span> : null}</div>
                  <span className="age">{e.when}</span>
                </li>
              ))}
              {recent.length === 0 ? <li className="empty" style={{ padding: "8px 0" }}>No sign-ins recorded yet.</li> : null}
            </ul>
            {recent.some((e) => !e.success) ? <span className="hint">If a failed sign-in wasn’t you, change your usercode and tell the Resident Manager.</span> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-h"><KeyRound size={16} /><h3>Change my usercode</h3><span className="sp" /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? "Hide" : "Show"}</button></div>
          <div className="card-b vstack" style={{ gap: 14 }}>
            <div className="field"><label htmlFor="ac-cur">Current usercode</label><input className="input mono" id="ac-cur" type={type} value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} autoComplete="current-password" /></div>
            <div className="field"><label htmlFor="ac-new">New usercode <span className="muted">(6 or more characters)</span></label><input className="input mono" id="ac-new" type={type} value={newCode} onChange={(e) => setNewCode(e.target.value)} autoComplete="new-password" /></div>
            <div className="field"><label htmlFor="ac-con">Type the new usercode again</label><input className="input mono" id="ac-con" type={type} value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} autoComplete="new-password" /></div>
            {error ? <div className="err-note" role="alert">{error}</div> : null}
            {success ? <div className="pill-note t-ok" role="status">Usercode changed. Use the new one next time you sign in.</div> : null}
            <div><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? "Saving…" : "Change usercode"}</button></div>
          </div>
        </section>
      </div>
    </>
  );
}
