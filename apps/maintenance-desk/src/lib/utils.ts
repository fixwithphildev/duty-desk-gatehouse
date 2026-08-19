// Server Actions that call redirect() throw a special error to hand control
// back to Next's router. When you call a Server Action directly from a
// client component (not via <form action>), that error surfaces in your
// try/catch — it must be re-thrown, not treated as a real failure.
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
