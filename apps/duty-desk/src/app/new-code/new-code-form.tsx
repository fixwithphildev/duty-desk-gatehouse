"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff, Home, KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { setOwnUsercodeAction, type NewCodeState } from "./actions";
import { signOutAction } from "../(app)/sign-out-action";

const initialState: NewCodeState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? "Saving…" : "Save and continue"}</button>;
}

export function NewCodeForm({ name, username }: { name: string; username: string }) {
  const [state, formAction] = useFormState(setOwnUsercodeAction, initialState);
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";

  return (
    <div className="signin p-dd">
      <section className="si-brand">
        <span />
        <div><div className="si-mark"><Home size={26} /></div></div>
        <div>
          <h2>Welcome, {name}</h2>
          <p className="tagl">The code you just used only works once. Choose your own usercode to finish signing in.</p>
        </div>
        <ul className="bul">
          <li><ShieldCheck size={18} /><span>Only you will know it. Nobody else, not even the Admin, can see it.</span></li>
          <li><KeyRound size={18} /><span>Use at least 6 letters and numbers that are easy for you to remember and hard to guess.</span></li>
          <li><Lock size={18} /><span>If you forget it, the Admin can give you a new one-time code.</span></li>
        </ul>
      </section>
      <section className="si-form">
        <form className="si-card" action={formAction}>
          <div><div className="over">First sign-in · {username}</div><h1 style={{ marginTop: 6 }}>Choose your usercode</h1></div>
          {state.error ? <div className="err-note" role="alert"><Lock size={16} /><span>{state.error}</span></div> : null}
          <div className="field">
            <label htmlFor="newCode">New usercode</label>
            <div className="input-wrap">
              <Lock size={16} />
              <input className="input mono si-code" id="newCode" name="newCode" type={type} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} minLength={6} required autoFocus />
              <button type="button" className="si-peek" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide usercodes" : "Show usercodes"} aria-pressed={show}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <span className="hint">6 or more characters. Mix letters and numbers.</span>
          </div>
          <div className="field">
            <label htmlFor="confirmCode">Type it again</label>
            <div className="input-wrap">
              <Lock size={16} />
              <input className="input mono si-code" id="confirmCode" name="confirmCode" type={type} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} minLength={6} required />
            </div>
          </div>
          <SaveButton />
          <button type="submit" formAction={signOutAction} formNoValidate className="btn btn-ghost btn-block"><LogOut size={15} /> Not you? Sign out</button>
        </form>
      </section>
    </div>
  );
}
