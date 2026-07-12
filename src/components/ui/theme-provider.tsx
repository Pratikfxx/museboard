"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_STORAGE_KEY = "museboard-theme";

const THEME_CHANGE_EVENT = "museboard:theme-change";
const THEME_SESSION_FALLBACK_KEY = "museboard-theme-session-fallback";
const SERVER_SNAPSHOT = "system:light";
let volatilePreference: ThemePreference | null = null;

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function resolveTheme(
  preference: ThemePreference,
  darkSystem: boolean,
): ResolvedTheme {
  return preference === "system"
    ? darkSystem
      ? "dark"
      : "light"
    : preference;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readPreference(): ThemePreference {
  if (volatilePreference) return volatilePreference;

  try {
    const fallbackPreference = window.sessionStorage.getItem(
      THEME_SESSION_FALLBACK_KEY,
    );
    if (isThemePreference(fallbackPreference)) return fallbackPreference;
  } catch {
    // Continue to persistent storage when session storage is unavailable.
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function getSnapshot(): string {
  const preference = readPreference();
  return `${preference}:${resolveTheme(preference, prefersDark())}`;
}

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  mediaQuery?.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    mediaQuery?.removeEventListener("change", onStoreChange);
  };
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function persistPreference(preference: ThemePreference): void {
  volatilePreference = preference;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    try {
      window.sessionStorage.removeItem(THEME_SESSION_FALLBACK_KEY);
      volatilePreference = null;
    } catch {
      // Keep the in-memory value authoritative if a stale fallback cannot clear.
    }
    return;
  } catch {
    // Fall back to session scope when persistent storage rejects the write.
  }

  try {
    window.sessionStorage.setItem(THEME_SESSION_FALLBACK_KEY, preference);
    volatilePreference = null;
  } catch {
    // The module-scoped value keeps the current tab consistent as a last resort.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [preference, resolvedTheme] = snapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];

  useEffect(() => {
    // Read the client snapshot again instead of applying the hydration fallback.
    // The head bootstrap already set the persisted theme before first paint.
    const currentResolvedTheme = getSnapshot().split(":")[1] as ResolvedTheme;
    applyResolvedTheme(currentResolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    persistPreference(nextPreference);
    applyResolvedTheme(resolveTheme(nextPreference, prefersDark()));
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const contextValue = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
