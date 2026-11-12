/**
 * Where to go after sign-in. Only a path inside this site is allowed, so the login page cannot be used
 * to send someone to another website.
 */
export function safeNext(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  return value;
}
