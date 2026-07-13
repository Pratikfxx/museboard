import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IdeaSculpture from "@/components/today/idea-sculpture";
import { TodayWorkspace } from "@/components/today/today-workspace";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

function activatePersonalizedWorkspace() {
  const workspace = buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "lifestyle_business",
    audience: "Independent designers rebuilding a sustainable creative habit",
    platforms: ["youtube_shorts", "tiktok_video"],
    weeklyCapacityMinutes: 240,
    voice: "Warm, candid, and precise",
    boundaries: "No fake urgency or trend chasing",
    firstHook: "Perfection is costing us the story.",
  });
  const [selectedOpportunity, ...otherOpportunities] = workspace.opportunities;
  const personalizedOpportunity = {
    ...selectedOpportunity,
    title: "The quiet return of imperfect creative work.",
    summary:
      "Behind-the-scenes process stories are outpacing polished content across your saved references.",
  };

  useMuseboardStore.getState().completeOnboarding({
    ...workspace,
    creator: { ...workspace.creator, name: "Maya Chen" },
    opportunities: [personalizedOpportunity, ...otherOpportunities],
    content: workspace.content.map((content) => ({
      ...content,
      title: personalizedOpportunity.title,
      versions: content.versions.map((version) => ({
        ...version,
        angle: "What I stopped polishing",
      })),
    })),
  });
}

function renderToday() {
  return render(
    <ThemeProvider>
      <TodayWorkspace />
    </ThemeProvider>,
  );
}

describe("Today workspace", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
    activatePersonalizedWorkspace();
  });

  it("renders the personalized daily decision from the active workspace", () => {
    renderToday();

    expect(
      screen.getByRole("heading", { name: /good morning, maya/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: /quiet return of imperfect creative work/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/behind-the-scenes process stories are outpacing/i),
    ).toBeVisible();
    expect(
      screen.getByText(/independent designers rebuilding a sustainable creative habit/i),
    ).toBeVisible();
    expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("chooses the selected hook and advances the active content to outline", async () => {
    const user = userEvent.setup();
    renderToday();

    await user.click(screen.getByLabelText(/contrarian/i));
    await user.click(screen.getByRole("button", { name: /choose a hook/i }));

    const store = useMuseboardStore.getState();
    const [activeContent] = store.content;
    expect(activeContent.stage).toBe("outline");
    expect(activeContent.versions.at(-1)?.selectedHookId).toBe(store.hooks[0].id);
    expect(screen.getByText(/hook chosen · outline is next/i)).toBeVisible();
  });

  it("opens an editable rewrite without discarding the selected hook", async () => {
    const user = userEvent.setup();
    renderToday();

    await user.click(
      screen.getByRole("button", { name: /rewrite in my voice/i }),
    );

    expect(
      screen.getByRole("textbox", { name: /rewrite selected hook/i }),
    ).toHaveValue("Perfection is costing us the story.");
    expect(
      screen.getByText(/warm, candid, and precise/i),
    ).toBeVisible();
  });
});

describe("Idea sculpture fallback", () => {
  it("uses the real themed raster and semantic label for reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const { container } = render(
      <ThemeProvider>
        <IdeaSculpture />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("figure", { name: /woven paths from signal to idea/i }),
    ).toBeVisible();
    expect(
      container.querySelector('[data-renderer="static"]'),
    ).toHaveAttribute("data-fallback-reason", "reduced-motion");
    expect(container.querySelectorAll('img[src*="idea-sculpture-"]')).toHaveLength(2);
    expect(screen.getByText("Process stories")).toBeVisible();
    expect(screen.getByText("Imperfection as trust")).toBeVisible();
    expect(screen.getByText("Creative courage")).toBeVisible();

    vi.unstubAllGlobals();
  });
});
