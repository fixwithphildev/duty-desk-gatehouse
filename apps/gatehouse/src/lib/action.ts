// Server actions hand back { ok, data } or { ok: false, error } instead of
// throwing: in a production build Next.js hides the message of an error thrown
// on the server, so people would only see "An error occurred". callAction()
// turns it back into a normal error on the client, where the page shows it.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function guarded<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // Redirects (signed out, no access) and not-found must still reach Next.js.
    if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return { ok: false, error: e instanceof Error && e.message ? e.message : "Something went wrong. Please try again." };
  }
}

export function callAction<A extends unknown[], T>(fn: (...args: A) => Promise<ActionResult<T>>) {
  return async (...args: A): Promise<T> => {
    const r = await fn(...args);
    // An action that sends you to another page (redirect) hands back nothing:
    // Next.js is already going there, so there is nothing to report.
    if (r == null) return undefined as T;
    if (!r.ok) throw new Error(r.error);
    return r.data;
  };
}
