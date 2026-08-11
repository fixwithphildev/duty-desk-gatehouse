"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/ui";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { changeOwnUsercodeAction } from "./actions";
import { DD_ROLE_LABELS, type DDRole } from "@/lib/types";

export function AccountClient({ username, displayName, role }: { username: string; displayName: string; role: DDRole }) {
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await changeOwnUsercodeAction({ currentCode, newCode, confirmCode });
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

  return (
    <div className="view">
      <div className="view-head"><h2>My Account</h2></div>

      <div className="card">
        <div className="card-head"><span>Details</span></div>
        <Field label="Username"><input className="input" value={username} disabled /></Field>
        <Field label="Display name"><input className="input" value={displayName} disabled /></Field>
        <Field label="Role"><input className="input" value={DD_ROLE_LABELS[role]} disabled /></Field>
      </div>

      <div className="card">
        <div className="card-head"><span>Change my usercode</span></div>
        {error ? <div className="login-error">{error}</div> : null}
        {success ? <div className="login-success">Usercode updated. Use it next time you sign in.</div> : null}
        <Field label="Current usercode">
          <input className="input mono" type="password" value={currentCode} onChange={(e) => setCurrentCode(e.target.value)} />
        </Field>
        <Field label="New usercode (6+ characters)">
          <input className="input mono" type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
        </Field>
        <Field label="Confirm new usercode">
          <input className="input mono" type="password" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
        </Field>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!currentCode || !newCode || !confirmCode || pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "Update usercode"}
        </button>
      </div>
    </div>
  );
}
