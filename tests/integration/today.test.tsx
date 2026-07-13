import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IdeaSculpture from "@/components/today/idea-sculpture";
import { TodayWorkspace } from "@/components/today/today-workspace";
import { ThemeProvider } from "@/components/ui/theme-provider";
import type { Learning } from "@/domain/schema";
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

  it("chooses once, derives the outline spine, and replaces Choose with the workshop action", async () => {
    const user = userEvent.setup();
    const beforeReview = useMuseboardStore.getState();
    useMuseboardStore.setState({
      entitlementUsage: { ...beforeReview.entitlementUsage, plan: "studio" },
    });
    const reviewedContentId = useMuseboardStore.getState().content[0].id;
    expect(useMuseboardStore.getState().assignStage({ contentId: reviewedContentId, stage: "review", reviewerMembershipId: "member-owner" })).toBe(true);
    expect(useMuseboardStore.getState().requestApproval(reviewedContentId, "member-owner")).toBe(true);
    expect(useMuseboardStore.getState().decideApproval(reviewedContentId, "approved")).toBe(true);
    renderToday();
    const versionsBefore = useMuseboardStore.getState().content[0].versions.length;

    await user.click(screen.getByLabelText(/contrarian/i));
    await user.click(screen.getByRole("button", { name: /choose a hook/i }));

    const store = useMuseboardStore.getState();
    const [activeContent] = store.content;
    expect(activeContent.stage).toBe("outline");
    expect(activeContent.versions.at(-1)?.selectedHookId).toBe(store.hooks[0].id);
    expect(activeContent.versions).toHaveLength(versionsBefore + 1);
    expect(store.approvals.map(({ status }) => status)).toEqual([
      "requested",
      "approved",
      "stale",
    ]);
    expect(screen.getByText(/hook chosen · outline is next/i)).toBeVisible();
    const spine = screen.getByRole("list", { name: /content workflow/i });
    expect(within(spine).getByText("Hook").closest("li")).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(within(spine).getByText("Outline").closest("li")).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(
      screen.queryByRole("button", { name: /choose a hook/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open outline workshop/i }),
    ).toHaveAttribute(
      "href",
      `/app/create/${activeContent.id}?stage=outline`,
    );
  });

  it("routes voice rewriting to the real workshop without mounting a local draft", () => {
    renderToday();
    const contentId = useMuseboardStore.getState().content[0].id;

    expect(
      screen.getByRole("link", { name: /rewrite in my voice/i }),
    ).toHaveAttribute("href", `/app/create/${contentId}?mode=voice`);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an opportunity-only state instead of leaking another opportunity's content", () => {
    const store = useMuseboardStore.getState();
    const unmatchedOpportunity = store.opportunities[1];
    store.selectOpportunity(unmatchedOpportunity.id);

    renderToday();

    expect(
      screen.getByRole("heading", { name: unmatchedOpportunity.title }),
    ).toBeVisible();
    expect(screen.getByText(unmatchedOpportunity.summary)).toBeVisible();
    expect(screen.queryByText("What I stopped polishing")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(/shape the hook: perfection/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /shape this opportunity/i }),
    ).toHaveAttribute(
      "href",
      `/app/opportunities/ideas?opportunityId=${unmatchedOpportunity.id}`,
    );
  });

  it("skips dismissed learnings when choosing the active learning strip", () => {
    const learnings = [
      {
        id: "dismissed-learning",
        metricKey: "hold-rate",
        metricDefinition: "Dismissed learning",
        platform: "youtube_shorts",
        statement: "Dismissed learning should stay hidden.",
        sampleSize: 40,
        confidence: "medium",
        includedContentIds: ["content-1"],
        dismissedAt: "2026-07-13T09:00:00.000Z",
      },
      {
        id: "active-learning",
        metricKey: "completion-rate",
        metricDefinition: "Active learning",
        platform: "youtube_shorts",
        statement: "Active learning should lead the strip.",
        sampleSize: 80,
        confidence: "high",
        includedContentIds: ["content-2"],
      },
    ] satisfies Learning[];
    useMuseboardStore.setState({ learnings });

    renderToday();

    expect(screen.getByText("Active learning should lead the strip.")).toBeVisible();
    expect(
      screen.queryByText("Dismissed learning should stay hidden."),
    ).not.toBeInTheDocument();
  });

  it("moves keyboard focus treatment from the hidden radio to the whole hook row", () => {
    renderToday();
    const radio = screen.getByRole("radio", { name: /contrarian/i });
    radio.focus();

    expect(radio).toHaveFocus();
    expect(radio.closest("label")).toHaveAttribute(
      "data-focus-ring",
      "hook-row",
    );
    const stylesheet = readFileSync(
      resolve(
        process.cwd(),
        "src/components/today/today-workspace.module.css",
      ),
      "utf8",
    );
    expect(stylesheet).toMatch(/\.hookOption:has\(input:focus-visible\)/u);
  });
});

describe("Idea sculpture fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    const images = container.querySelectorAll('img[src*="idea-sculpture-"]');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute(
      "src",
      expect.stringContaining("idea-sculpture-light.png"),
    );
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(screen.getByText("Process stories")).toBeVisible();
    expect(screen.getByText("Imperfection as trust")).toBeVisible();
    expect(screen.getByText("Creative courage")).toBeVisible();
  });
});
