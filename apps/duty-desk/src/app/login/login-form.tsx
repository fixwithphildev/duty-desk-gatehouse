"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, Clock, Eye, EyeOff, Home, Lock, ShieldCheck, User } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="signin p-dd">
      <section className="si-brand">
        {PORTAL_URL ? (
          <a href={PORTAL_URL} className="si-back"><ArrowLeft size={14} /> All platforms</a>
        ) : <span />}
        <div><div className="si-mark"><Home size={26} /></div></div>
        <div>
          <h2>Duty Desk</h2>
          <p className="tagl">Resident Officer operations: readiness checklists, complaints, maintenance and the duty log.</p>
        </div>
        <ul className="bul">
          <li><ShieldCheck size={18} /><span>Every entry is signed to your login and timestamped. Nobody can log under your name.</span></li>
          <li><Lock size={18} /><span>Five wrong usercodes lock the account for 15 minutes.</span></li>
          <li><Clock size={18} /><span>Shared desks sign you out after 20 minutes without use. Personal phones stay signed in.</span></li>
        </ul>
      </section>
      <section className="si-form">
        <form className="si-card" action={formAction}>
          <div><div className="over">The Destination</div><h1 style={{ marginTop: 6 }}>Sign in to Duty Desk</h1></div>
          {state.error ? <div className="err-note" role="alert"><Lock size={16} /><span>{state.error}</span></div> : null}
          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="input-wrap">
              <User size={16} />
              <input className="input" id="username" name="username" autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} required autoFocus />
            </div>
            <span className="hint">Given to you when your account was made.</span>
          </div>
          <div className="field">
            <label htmlFor="usercode">Usercode</label>
            <div className="input-wrap">
              <Lock size={16} />
              <input
                className="input mono si-code"
                id="usercode"
                name="usercode"
                type={showCode ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <button type="button" className="si-peek" onClick={() => setShowCode((v) => !v)} aria-label={showCode ? "Hide usercode" : "Show usercode"} aria-pressed={showCode}>
                {showCode ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <span className="hint">The one-time code you were given, or the usercode you chose.</span>
          </div>
          <label className="check">
            <input type="checkbox" name="persistent" /> Keep me signed in on this device (personal phones only)
          </label>
          <SubmitButton />
          <span className="hint" style={{ textAlign: "center" }}>Forgot your usercode? Ask the Admin to reset it.</span>
        </form>
      </section>
    </div>
  );
}
