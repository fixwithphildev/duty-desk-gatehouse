"use server";

import { redirect } from "next/navigation";
import { attemptLogin } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const usercode = String(formData.get("usercode") ?? "");
  const persistent = formData.get("persistent") === "on";

  const result = await attemptLogin(username, usercode, persistent);
  if (!result.ok) {
    return { error: result.error };
  }
  redirect("/dashboard");
}
