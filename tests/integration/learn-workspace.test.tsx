import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { LearnWorkspace } from "@/components/learn/learn-workspace";
import { createDemoState } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("Learn workspace creator loop", () => {
  beforeEach(() => {
    useMuseboardStore.setState({
      ...createDemoState(),
      learnings: [{
        id: "learning-hook",
        metricKey: "hold-rate",
        metricDefinition: "3-second hold rate",
        platform: "instagram_reels",
        statement: "Question hooks held attention longer in comparable posts.",
        sampleSize: 12,
        confidence: "medium",
        includedContentIds: ["content-desk"],
      }],
    });
  });

  it("turns a measured learning into an attributable next-post hypothesis", async () => {
    const user = userEvent.setup();
    render(<LearnWorkspace />);

    await user.click(screen.getByRole("button", { name: /use in next post/i }));

    expect(useMuseboardStore.getState().hypotheses).toEqual([
      expect.objectContaining({
        contentId: "content-desk",
        learningId: "learning-hook",
        statement: "Question hooks held attention longer in comparable posts.",
      }),
    ]);
    expect(screen.getByRole("status")).toHaveTextContent(/saved as a hypothesis/i);
  });
});
