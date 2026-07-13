import { beforeEach, describe, expect, it } from "vitest";

import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("promoted idea workshop", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("creates three usable hook choices when an idea is promoted", () => {
    const workspace = buildStarterWorkspace({
      outcome: "find_ideas",
      archetype: "music",
      audience: "Independent artists",
      platforms: ["instagram_reels"],
      weeklyCapacityMinutes: 240,
      voice: "Warm and specific",
      boundaries: "No fake urgency",
      firstHook: "The unfinished version is the useful one.",
    });
    useMuseboardStore.getState().completeOnboarding(workspace);

    const opportunityId = workspace.opportunities[1].id;
    const ideaId = useMuseboardStore.getState().shapeOpportunity(opportunityId);
    expect(ideaId).toBeTruthy();

    const contentId = useMuseboardStore.getState().promoteIdea(ideaId!);
    expect(contentId).toBeTruthy();

    const state = useMuseboardStore.getState();
    const hooks = state.hooks.filter((hook) => hook.contentId === contentId);
    const promoted = state.content.find((item) => item.id === contentId);

    expect(hooks).toHaveLength(3);
    expect(hooks.every((hook) => hook.text.trim().length > 0)).toBe(true);
    expect(promoted?.versions[0].selectedHookId).toBe(hooks[0].id);
    expect(promoted?.versions[0].selectedHookText).toBe(hooks[0].text);
  });
});
