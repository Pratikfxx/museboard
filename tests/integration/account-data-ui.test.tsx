import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AccountDataWorkspace } from "@/components/account/account-data-workspace";
import { THEME_STORAGE_KEY } from "@/components/ui/theme-provider";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("account data settings", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("requires the exact destructive phrase and preserves theme preference", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<AccountDataWorkspace />);

    const confirmation = screen.getByLabelText(/type delete sample workspace to confirm/i);
    const deleteButton = screen.getByRole("button", { name: /delete sample workspace from this device/i });
    expect(deleteButton).toBeDisabled();

    await user.type(confirmation, "delete sample workspace");
    expect(deleteButton).toBeDisabled();
    await user.clear(confirmation);
    await user.type(confirmation, "DELETE SAMPLE WORKSPACE");
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    expect(screen.getByRole("status")).toHaveTextContent(/no cloud account or provider data was deleted/i);
    expect(useMuseboardStore.getState().content).toEqual([]);
    expect(useMuseboardStore.getState().opportunities).toEqual([]);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("labels export and deletion as local sample operations", () => {
    render(<AccountDataWorkspace />);

    expect(screen.getByText(/sample workspace · this device only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download workspace json/i })).toBeEnabled();
    expect(screen.getByText(/no cloud export job/i)).toBeInTheDocument();
  });
});
