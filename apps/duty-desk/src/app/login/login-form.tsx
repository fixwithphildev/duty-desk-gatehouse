"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Home } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary drawer-submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <Home size={20} />
          <span className="login-brand-text">DUTY DESK</span>
        </div>
        <div className="login-sub">Resident Officer department — sign in with your username and usercode.</div>

        {state.error ? <div className="login-error">{state.error}</div> : null}

        <form action={formAction}>
          <div className="field">
            <span className="field-label">Username</span>
            <input className="input" name="username" autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <span className="field-label">Usercode</span>
            <input
              className="input mono"
              name="usercode"
              type="password"
              autoComplete="current-password"
              maxLength={8}
              required
            />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" name="persistent" />
            <span>This is my personal device — keep me signed in</span>
          </label>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
