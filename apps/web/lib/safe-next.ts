/** Returns `next` if it's a same-site path, otherwise /dashboard. Prevents open redirects. */
export function safeNext(next: string | null | undefined): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/dashboard";
}
