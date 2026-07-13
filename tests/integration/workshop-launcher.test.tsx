import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { WorkshopWorkspace } from "@/components/workshop/workshop-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("Create launcher", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("guides creators to ideas and offers a real draft to continue", () => {
    render(<WorkshopWorkspace contentId="new" />);

    expect(screen.getByRole("heading", { name: /move an idea into the work/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /open idea board/i })).toHaveAttribute(
      "href",
      "/app/opportunities/ideas",
    );
    expect(screen.getByRole("link", { name: /find an opportunity/i })).toHaveAttribute(
      "href",
      "/app/opportunities",
    );
    expect(screen.getByRole("link", { name: /desk reset/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/app/create/content-desk"),
    );
  });
});
