import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapTheme } from "@/components/ui/theme-bootstrap";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type ColorSchemeController = {
  setDark: (matches: boolean) => void;
};

function installColorScheme(dark = false): ColorSchemeController {
  let matches = dark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === "change" && typeof listener === "function") {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === "change" && typeof listener === "function") {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return {
    setDark(nextMatches) {
      matches = nextMatches;
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function renderThemeToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("theme preference", () => {
  let colorScheme: ColorSchemeController;

  beforeEach(() => {
    colorScheme = installColorScheme();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists an explicit dark preference", async () => {
    const user = userEvent.setup();

    renderThemeToggle();

    await user.click(screen.getByRole("button", { name: /theme/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("museboard-theme")).toBe("dark");
  });

  it.each([
    { preference: "light", darkSystem: true, expectedTheme: "light" },
    { preference: "dark", darkSystem: false, expectedTheme: "dark" },
    { preference: "system", darkSystem: true, expectedTheme: "dark" },
  ])(
    "restores a stored $preference preference",
    async ({ preference, darkSystem, expectedTheme }) => {
      colorScheme.setDark(darkSystem);
      localStorage.setItem("museboard-theme", preference);

      renderThemeToggle();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /theme/i })).toHaveAccessibleName(
          `Theme: ${preference}`,
        );
        expect(document.documentElement.dataset.theme).toBe(expectedTheme);
      });
    },
  );

  it("updates a stored system preference when the media query changes", async () => {
    localStorage.setItem("museboard-theme", "system");
    renderThemeToggle();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    act(() => colorScheme.setDark(true));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(localStorage.getItem("museboard-theme")).toBe("system");
  });

  it("treats an invalid stored preference as system", async () => {
    colorScheme.setDark(true);
    localStorage.setItem("museboard-theme", "sepia");

    renderThemeToggle();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /theme/i })).toHaveAccessibleName(
        "Theme: system",
      );
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  it("applies the persisted preference during pre-hydration bootstrap", () => {
    colorScheme.setDark(false);
    localStorage.setItem("museboard-theme", "dark");

    bootstrapTheme();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("keeps context and DOM aligned when local storage rejects a write", async () => {
    const user = userEvent.setup();
    const originalStorage = window.localStorage;
    const failingStorage: Storage = {
      get length() {
        return originalStorage.length;
      },
      clear: () => originalStorage.clear(),
      getItem: (key) => originalStorage.getItem(key),
      key: (index) => originalStorage.key(index),
      removeItem: (key) => originalStorage.removeItem(key),
      setItem: () => {
        throw new DOMException("Storage is unavailable", "QuotaExceededError");
      },
    };
    vi.stubGlobal("localStorage", failingStorage);

    renderThemeToggle();
    const trigger = screen.getByRole("button", { name: /theme/i });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    await waitFor(() => {
      expect(trigger).toHaveAccessibleName("Theme: dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });
});

describe("theme menu keyboard behavior", () => {
  beforeEach(() => {
    installColorScheme();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("manages item focus and restores the trigger on Escape", async () => {
    const user = userEvent.setup();
    localStorage.setItem("museboard-theme", "dark");
    renderThemeToggle();

    const trigger = screen.getByRole("button", { name: /theme/i });
    await waitFor(() => expect(trigger).toHaveAccessibleName("Theme: dark"));
    await user.click(trigger);

    const light = screen.getByRole("menuitemradio", { name: /light/i });
    const dark = screen.getByRole("menuitemradio", { name: /dark/i });
    const system = screen.getByRole("menuitemradio", { name: /system/i });
    await waitFor(() => expect(dark).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(system).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(light).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(system).toHaveFocus();
    await user.keyboard("{Home}");
    expect(light).toHaveFocus();
    await user.keyboard("{End}");
    expect(system).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it.each([
    { key: "{Enter}", label: "Enter" },
    { key: " ", label: "Space" },
  ])(
    "closes and restores trigger focus when a menu item is activated with $label",
    async ({ key }) => {
      const user = userEvent.setup();
      renderThemeToggle();

      const trigger = screen.getByRole("button", { name: /theme/i });
      await user.click(trigger);
      const light = screen.getByRole("menuitemradio", { name: /light/i });
      await waitFor(() =>
        expect(
          screen.getByRole("menuitemradio", { name: /system/i }),
        ).toHaveFocus(),
      );
      await user.keyboard("{Home}");
      expect(light).toHaveFocus();

      await user.keyboard(key);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAccessibleName("Theme: light");
      expect(localStorage.getItem("museboard-theme")).toBe("light");
    },
  );
});
