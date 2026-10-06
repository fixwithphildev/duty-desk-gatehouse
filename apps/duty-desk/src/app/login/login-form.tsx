"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary drawer-submit" disabled={pending}>
      {pending ? "Signing in…" : <>Sign in <ArrowRight size={17} /></>}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="login-shell">
      <aside className="login-photo">
        {PORTAL_URL ? (
          <a href={PORTAL_URL} className="login-back">
            <ArrowLeft size={15} />
            Back to portal
          </a>
        ) : <span />}
        <div>
          <div className="login-photo-eyebrow">The Destination</div>
          <div className="login-photo-title">Duty Desk</div>
        </div>
      </aside>

      <main className="login-side">
        <ThemeToggle className="topbar-btn login-theme icon-btn" />
        <div className="login-card">
          <div className="eyebrow login-brand">Resident Officers</div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub">Sign in with the username and usercode your supervisor gave you.</p>

          {state.error ? <div className="login-error" role="alert">{state.error}</div> : null}

          <form action={formAction}>
            <div className="field">
              <label className="field-label" htmlFor="username">Username</label>
              <input className="input" id="username" name="username" autoComplete="username" required autoFocus />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="usercode">Usercode</label>
              <div className="input-wrap">
                <input
                  className="input mono login-code"
                  id="usercode"
                  name="usercode"
                  type={showCode ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={8}
                  required
                />
                <button type="button" className="peek-btn" onClick={() => setShowCode((v) => !v)} aria-label={showCode ? "Hide usercode" : "Show usercode"} aria-pressed={showCode}>
                  {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" name="persistent" />
              <span>This is my personal device — keep me signed in</span>
            </label>
            <SubmitButton />
          </form>
          <div className="login-help">Forgot your usercode? Ask your supervisor.</div>
        </div>
      </main>
    </div>
  );
}
