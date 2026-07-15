import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import { ThemeProvider } from "@/components/ui/theme-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/today",
}));

describe("App shell More sheet focus", () => {
  it("traps keyboard focus and restores it to the More trigger", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><AppShell><p>Workspace content</p></AppShell></ThemeProvider>);

    const trigger = screen.getByRole("button", { name: "More" });
    await user.click(trigger);
    const close = await screen.findByRole("button", { name: /close more menu/i });
    await waitFor(() => expect(close).toHaveFocus());

    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: /data controls/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
