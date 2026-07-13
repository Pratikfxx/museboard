import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBoundaryState } from "@/components/ui/error-boundary";
import { LoadingState } from "@/components/ui/loading-state";

describe("shared experience states", () => {
  it("gives empty and loading moments useful context", () => {
    render(<><EmptyState title="No ideas yet" detail="Capture one honest spark." /><LoadingState label="Loading your plan" /></>);

    expect(screen.getByRole("heading", { name: "No ideas yet" })).toBeVisible();
    expect(screen.getByText("Capture one honest spark.")).toBeVisible();
    expect(screen.getByRole("status", { name: "Loading your plan" })).toBeVisible();
  });

  it("offers a real retry action after an error", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBoundaryState reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
