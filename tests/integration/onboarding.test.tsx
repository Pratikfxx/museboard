import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { useMuseboardStore } from "@/lib/store/museboard-store";

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
    expect(store.creator?.archetype).toBe("music");
    expect(store.creator?.weeklyCapacityMinutes).toBe(240);
    expect(store.opportunities).toHaveLength(5);
    expect(store.opportunities.every(({ archetypes }) => archetypes.includes("music"))).toBe(
      true,
    );
    expect(store.plannerTasks.length).toBeGreaterThan(0);
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

  it("remains usable when draft persistence is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    render(<OnboardingFlow />);
    await user.click(
      await screen.findByRole("button", { name: /plan my next week/i }),
    );

    expect(
      screen.getByRole("heading", { name: /what kind of creator are you/i }),
    ).toBeVisible();
  });
});
