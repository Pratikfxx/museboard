import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/today",
}));

describe("App shell navigation", () => {
  it("keeps the four core mobile actions and opens an accessible More sheet", async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Workspace content</p></AppShell>);

    const mobileNav = screen.getByRole("navigation", { name: "Mobile primary" });
    expect(mobileNav).toHaveTextContent("Today");
    expect(mobileNav).toHaveTextContent("Opportunities");
    expect(mobileNav).toHaveTextContent("Create");
    expect(mobileNav).toHaveTextContent("Plan");
    expect(mobileNav).not.toHaveTextContent("Learn");

    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More Museboard destinations" });
    expect(sheet).toBeVisible();
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/app/learn");
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/app/team");
    expect(screen.getByRole("link", { name: /data controls/i })).toHaveAttribute("href", "/app/settings/data");
  });

  it("provides a skip link that targets the workspace main content", () => {
    render(<AppShell><p>Workspace content</p></AppShell>);

    expect(screen.getByRole("link", { name: "Skip to workspace" })).toHaveAttribute(
      "href",
      "#workspace-main",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "workspace-main");
  });
});
