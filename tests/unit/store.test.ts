import { beforeEach, describe, expect, it } from "vitest";

import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("Museboard demo store", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("keeps explicit sample mode while completing onboarding", () => {
    useMuseboardStore.getState().completeOnboarding({
      name: "Aarav",
      archetype: "tech_education",
      weeklyCapacityMinutes: 300,
    });

    const state = useMuseboardStore.getState();
    expect(state.dataMode).toBe("sample");
    expect(state.onboardingComplete).toBe(true);
    expect(state.creator?.name).toBe("Aarav");
  });

  it("rejects malformed provider metrics without changing state", () => {
    const before = useMuseboardStore.getState().metrics;

    const imported = useMuseboardStore
      .getState()
      .importMetrics([{ metricKey: "views" }]);

    expect(imported).toBe(false);
    expect(useMuseboardStore.getState().metrics).toBe(before);
  });

  it("clears optional user selections when the demo is reset", () => {
    const state = useMuseboardStore.getState();
    state.completeOnboarding({
      name: "Aarav",
      archetype: "tech_education",
      weeklyCapacityMinutes: 300,
    });
    state.selectOpportunity("opportunity-desk");

    useMuseboardStore.getState().resetDemo();

    expect(useMuseboardStore.getState().creator).toBeUndefined();
    expect(useMuseboardStore.getState().selectedOpportunityId).toBeUndefined();
  });
});
