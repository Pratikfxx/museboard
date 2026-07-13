import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { DEMO_NOW } from "@/lib/demo/fixtures";
import {
  MUSEBOARD_STORAGE_KEY,
  useMuseboardStore,
} from "@/lib/store/museboard-store";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

async function completeMusicCreatorFlow() {
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole("button", { name: /plan my next week/i }),
  );
  await user.click(screen.getByRole("button", { name: /music creator/i }));

  await user.type(
    screen.getByRole("textbox", { name: /what should we call you/i }),
    "Maya Chen",
  );
  const audience = screen.getByRole("textbox", {
    name: /who do you make things for/i,
  });
  await user.clear(audience);
  await user.type(audience, "Independent artists learning to release consistently");
  await user.click(
    screen.getByRole("button", { name: /continue to formats/i }),
  );

  await user.click(screen.getByRole("checkbox", { name: /instagram reels/i }));
  await user.click(screen.getByRole("checkbox", { name: /tiktok video/i }));
  await user.click(
    screen.getByRole("button", { name: /continue to capacity/i }),
  );

  await user.click(screen.getByRole("button", { name: /4 hours per week/i }));

  const voice = screen.getByRole("textbox", { name: /describe your voice/i });
  await user.clear(voice);
  await user.type(voice, "Warm, practical, and direct");
  await user.click(
    screen.getByRole("button", { name: /continue to boundaries/i }),
  );

  const boundaries = screen.getByRole("textbox", {
    name: /what should museboard avoid/i,
  });
  await user.clear(boundaries);
  await user.type(boundaries, "No fake urgency or trend chasing");
  await user.click(
    screen.getByRole("button", { name: /continue to your first hook/i }),
  );

  const hook = screen.getByRole("textbox", { name: /write your first hook/i });
  await user.clear(hook);
  await user.type(hook, "Your unfinished chorus is already content.");
  await user.click(
    screen.getByRole("button", { name: /create sample workspace/i }),
  );
}

describe("creator onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    useMuseboardStore.getState().resetDemo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a personalized starter workspace without connecting a social account", async () => {
    render(<OnboardingFlow />);

    await completeMusicCreatorFlow();

    const store = useMuseboardStore.getState();
    expect(store.creator?.outcome).toBe("plan_week");
    expect(store.creator?.archetype).toBe("music");
    expect(store.creator?.name).toBe("Maya Chen");
    expect(store.creator?.archetypes).toEqual(["music"]);
    expect(store.creator?.audience).toBe(
      "Independent artists learning to release consistently",
    );
    expect(store.creator?.platforms).toEqual(["tiktok_video"]);
    expect(store.creator?.weeklyCapacityMinutes).toBe(240);
    expect(store.creator?.voiceTraits).toEqual(["Warm", "practical", "direct"]);
    expect(store.creator?.boundaries).toEqual([
      "No fake urgency or trend chasing",
    ]);
    expect(store.creator?.contentPillars).toHaveLength(3);
    expect(store.opportunities).toHaveLength(5);
    expect(store.opportunities.every(({ archetypes }) => archetypes.includes("music"))).toBe(
      true,
    );
    expect(store.selectedOpportunityId).toBe(store.opportunities[0].id);

    expect(store.content).toHaveLength(1);
    const [content] = store.content;
    expect(content.archetype).toBe("music");
    expect(content.title).not.toMatch(/desk/i);
    expect(content.opportunityId).toBe(store.selectedOpportunityId);

    expect(store.hooks).toHaveLength(3);
    expect(store.hooks.every(({ contentId }) => contentId === content.id)).toBe(
      true,
    );
    expect(store.hooks.map(({ text }) => text)).toContain(
      "Your unfinished chorus is already content.",
    );
    expect(content.versions[0].selectedHookId).toBe(store.hooks[0].id);

    expect(store.plannerTasks).toHaveLength(3);
    expect(
      store.plannerTasks.every(
        ({ contentId, scheduledFor }) =>
          contentId === content.id && scheduledFor !== undefined,
      ),
    ).toBe(true);
    const weekStart = new Date(DEMO_NOW).getTime();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
    expect(
      store.plannerTasks.every(({ scheduledFor }) => {
        const scheduledAt = new Date(scheduledFor ?? "").getTime();
        return scheduledAt >= weekStart && scheduledAt < weekEnd;
      }),
    ).toBe(true);
    expect(
      new Set(store.plannerTasks.map(({ scheduledFor }) => scheduledFor)).size,
    ).toBe(3);
    expect(
      store.plannerTasks.reduce(
        (total, { estimatedMinutes }) => total + estimatedMinutes,
        0,
      ),
    ).toBeLessThanOrEqual(240 * 0.8);
    const persisted = JSON.parse(
      localStorage.getItem(MUSEBOARD_STORAGE_KEY) ?? "{}",
    ).state;
    expect(persisted.creator).toEqual(store.creator);
    expect(persisted.opportunities).toEqual(store.opportunities);
    expect(persisted.content).toEqual(store.content);
    expect(persisted.hooks).toEqual(store.hooks);
    expect(persisted.plannerTasks).toEqual(store.plannerTasks);
    expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
    expect(push).toHaveBeenCalledWith("/app/today");
  });

  it("resumes at the last persisted question", async () => {
    const user = userEvent.setup();
    const firstRender = render(<OnboardingFlow />);

    await user.click(
      await screen.findByRole("button", { name: /grow with a clear system/i }),
    );
    firstRender.unmount();
    render(<OnboardingFlow />);

    expect(
      await screen.findByRole("heading", { name: /what kind of creator are you/i }),
    ).toBeVisible();
  });

  it("finishes and retains the personalized workspace in memory when browser storage is denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    render(<OnboardingFlow />);
    await completeMusicCreatorFlow();

    const store = useMuseboardStore.getState();
    expect(push).toHaveBeenCalledWith("/app/today");
    expect(store.onboardingComplete).toBe(true);
    expect(store.creator?.archetypes).toEqual(["music"]);
    expect(store.opportunities).toHaveLength(5);
    expect(store.content).toHaveLength(1);
    expect(store.content[0].archetype).toBe("music");
    expect(store.hooks).toHaveLength(3);
    expect(store.plannerTasks.every(({ scheduledFor }) => scheduledFor)).toBe(
      true,
    );
  });
});
