import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

describe("theme preference", () => {
  it("persists an explicit dark preference", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /theme/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("museboard-theme")).toBe("dark");
  });
});
