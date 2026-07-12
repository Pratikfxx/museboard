export function bootstrapTheme(): void {
  const storageKey = "museboard-theme";
  const fallbackKey = "museboard-theme-session-fallback";
  let storedPreference: string | null = null;
  let fallbackPreference: string | null = null;

  try {
    storedPreference = window.localStorage.getItem(storageKey);
  } catch {
    // A system preference remains a safe default when persistent storage is blocked.
  }

  try {
    fallbackPreference = window.sessionStorage.getItem(fallbackKey);
  } catch {
    // Session storage can be unavailable under the same privacy restrictions.
  }

  const isPreference = (value: string | null) =>
    value === "light" || value === "dark" || value === "system";
  const preference = isPreference(fallbackPreference)
    ? fallbackPreference
    : isPreference(storedPreference)
      ? storedPreference
      : "system";
  const darkSystem =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const theme =
    preference === "system"
      ? darkSystem
        ? "dark"
        : "light"
      : preference;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const THEME_BOOTSTRAP_SCRIPT = `(${bootstrapTheme.toString()})();`;
