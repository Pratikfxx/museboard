export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/app/today",
): string {
  let decoded = candidate;
  try {
    decoded = candidate ? decodeURIComponent(candidate) : candidate;
  } catch {
    return fallback;
  }
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    decoded?.startsWith("//") ||
    decoded?.includes("\\")
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://museboard.local");
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
