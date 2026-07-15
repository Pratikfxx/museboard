import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { createDemoState } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/today",
}));

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell><p>Workspace content</p></AppShell>
    </ThemeProvider>,
  );
}

describe("App shell navigation", () => {
  beforeEach(() => useMuseboardStore.setState(createDemoState()));

  it("keeps the four core mobile actions and opens an accessible More sheet", async () => {
    const user = userEvent.setup();
    renderShell();

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
    renderShell();

    expect(screen.getByRole("link", { name: "Skip to workspace" })).toHaveAttribute(
      "href",
      "#workspace-main",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "workspace-main");
  });

  it("keeps theme, queued captures, and recovery visible from every workspace route", () => {
    useMuseboardStore.setState({
      offlineCaptures: [
        { id: "capture-1", text: "Explain the chorus", status: "queued", createdAt: "2026-07-15T04:00:00.000Z" },
      ],
      recoveryNotice: {
        id: "recovery-1",
        kind: "invalid_workspace",
        title: "Your saved workspace needs recovery",
        detail: "A protected copy is ready.",
        backupKey: "museboard-recovery-backup-v1",
        detectedAt: "2026-07-15T04:00:00.000Z",
      },
    });

    renderShell();

    expect(screen.getByRole("button", { name: /theme:/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /1 queued capture/i })).toHaveAttribute(
      "href",
      "/app/today#capture-inbox",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your saved workspace needs recovery",
    );
  });
});
