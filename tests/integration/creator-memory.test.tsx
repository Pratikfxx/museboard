import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CreatorMemoryWorkspace } from "@/components/memory/creator-memory-workspace";
import { createDemoState } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("Creator memory", () => {
  beforeEach(() => useMuseboardStore.setState(createDemoState()));

  it("saves an inspectable new voice-memory revision", async () => {
    const user = userEvent.setup();
    render(<CreatorMemoryWorkspace />);

    await user.type(screen.getByLabelText(/phrases to favor/i), "Clear beats clever\nShow the tradeoff");
    await user.type(screen.getByLabelText(/phrases to avoid/i), "Game-changing");
    await user.click(screen.getByRole("button", { name: /save memory revision/i }));

    expect(useMuseboardStore.getState().creatorMemory).toMatchObject({
      version: 2,
      preferredPhrases: ["Clear beats clever", "Show the tradeoff"],
      avoidPhrases: ["Game-changing"],
    });
    expect(screen.getByRole("status")).toHaveTextContent(/revision 2 saved/i);
  });
});
