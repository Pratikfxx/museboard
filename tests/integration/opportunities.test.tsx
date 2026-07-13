import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OpportunitiesWorkspace,
  VisionBoardView,
  type VisionFileHasher,
} from "@/components/opportunities/opportunities-workspace";
import { OwnerOpportunityConsole } from "@/components/opportunities/owner-opportunity-console";
import { ThemeProvider } from "@/components/ui/theme-provider";
import type { Opportunity } from "@/domain/opportunities";
import {
  CRAFT_GUIDES,
  VISION_IMAGE_PDF_MAX_BYTES,
  VISION_VIDEO_MAX_BYTES,
  VISION_WORKSPACE_QUOTA_BYTES,
  matchCraftGuides,
  previewCuratedOpportunity,
  rankOpportunity,
  validateVisionReference,
} from "@/lib/providers/opportunities";
import {
  MUSEBOARD_STORAGE_KEY,
  useMuseboardStore,
} from "@/lib/store/museboard-store";

const validHash = "a".repeat(64);

function renderWorkspace(view: "for-you" | "ideas" | "vision" = "for-you") {
  return render(
    <ThemeProvider>
      <OpportunitiesWorkspace view={view} />
    </ThemeProvider>,
  );
}

describe("Opportunity integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("shows every sample signal with source, observation, expiry, geography, platform, and factors", () => {
    renderWorkspace();

    expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
    const story = screen.getByRole("article", {
      name: /the low-friction creator desk/i,
    });
    expect(within(story).getByText(/fresh 3h ago/i)).toHaveAccessibleDescription(
      /source.+observed.+expires/i,
    );
    expect(within(story).getByText(/global/i)).toBeVisible();
    expect(within(story).getByText(/instagram reels/i)).toBeVisible();
    expect(within(story).getByText(/sample signal · not live/i)).toBeVisible();
    const breakdown = within(story).getByRole("list", {
      name: /ranking factor breakdown/i,
    });
    expect(within(breakdown).getByText(/relevance · 40% weight/i)).toBeVisible();
    expect(within(breakdown).getByText(/36.8 points/i)).toBeVisible();
    expect(within(breakdown).getByText(/momentum · 30% weight/i)).toBeVisible();
    expect(within(breakdown).getByText(/22.8 points/i)).toBeVisible();
    expect(within(breakdown).getByText(/originality · 15% weight/i)).toBeVisible();
    expect(within(breakdown).getByText(/12.15 points/i)).toBeVisible();
    expect(within(breakdown).getByText(/creator fit · 15% weight/i)).toBeVisible();
    expect(within(breakdown).getByText(/14.1 points/i)).toBeVisible();
    expect(
      within(story).getByText(/creator submission source class/i),
    ).toBeVisible();
  });

  it("caps an otherwise perfect rank when evidence is missing", () => {
    const missingEvidence: Opportunity = {
      ...useMuseboardStore.getState().opportunities[0],
      signals: {
        relevance: 100,
        momentum: 100,
        originality: 100,
        creatorFit: 100,
      },
      evidence: [],
      provenance: {
        ...useMuseboardStore.getState().opportunities[0].provenance,
        sourceUrl: undefined,
      },
    };

    expect(rankOpportunity(missingEvidence).score).not.toBeGreaterThan(95);
    expect(rankOpportunity(missingEvidence).evidenceComplete).toBe(false);
  });

  it("keeps expired signals out of the active For You recommendation set", () => {
    const [expired, ...active] = useMuseboardStore.getState().opportunities;
    useMuseboardStore.setState({
      opportunities: [
        {
          ...expired,
          provenance: {
            ...expired.provenance,
            expiresAt: "2026-07-13T08:59:59.000Z",
          },
        },
        ...active,
      ],
    });

    renderWorkspace();

    expect(
      screen.queryByRole("heading", { name: expired.title }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(active.length);
  });

  it("persists save, dismiss, and safe idea shaping without duplicate promotion", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();
    const stories = screen.getAllByRole("article");
    const first = stories[0];
    const second = stories[1];

    await user.click(within(first).getByRole("button", { name: /save/i }));
    await user.click(
      within(first).getByRole("button", { name: /shape idea/i }),
    );
    await user.click(
      within(first).getByRole("button", { name: /shape idea/i }),
    );
    await user.click(within(second).getByRole("button", { name: /dismiss/i }));

    const state = useMuseboardStore.getState();
    expect(state.opportunityDecisions[state.opportunities[0].id]).toBe("saved");
    expect(state.opportunityDecisions[state.opportunities[1].id]).toBe(
      "dismissed",
    );
    expect(state.ideas).toHaveLength(1);
    expect(state.ideas[0].provenance.opportunityId).toBe(
      state.opportunities[0].id,
    );
    expect(
      JSON.parse(localStorage.getItem(MUSEBOARD_STORAGE_KEY) ?? "{}").state
        .ideas,
    ).toHaveLength(1);

    view.rerender(
      <ThemeProvider>
        <OpportunitiesWorkspace view="ideas" />
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: /idea board/i })).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: state.opportunities[0].title,
      }),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /group ideas by/i }),
      "pillar",
    );
    expect(
      screen.getByRole("heading", {
        name: new RegExp(state.opportunities[0].pillar, "i"),
      }),
    ).toBeVisible();
    expect(screen.getByText(/promotion keeps source provenance/i)).toBeVisible();
    const contentBefore = useMuseboardStore.getState().content.length;
    await user.click(
      screen.getByRole("button", { name: /promote to workshop/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /promoted to workshop/i }),
    );
    const promotedState = useMuseboardStore.getState();
    expect(promotedState.content).toHaveLength(contentBefore + 1);
    expect(promotedState.content.at(-1)).toMatchObject({
      opportunityId: state.opportunities[0].id,
      stage: "angle",
    });
    expect(
      screen.getByRole("link", { name: /open in workshop/i }),
    ).toHaveAttribute(
      "href",
      `/app/create/${promotedState.content.at(-1)?.id}?stage=angle`,
    );
  });

  it("returns keyboard focus to the craft guide trigger after Escape", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const trigger = screen.getByRole("button", { name: "Craft guide" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Craft guide" })).toBeVisible();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves craft context to the opportunity the creator actively shapes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Craft guide" }));
    expect(
      screen.getByRole("heading", { name: /reel · open on the useful contrast/i }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /close craft guide/i }));

    const chorus = screen.getByRole("article", {
      name: /build the chorus in public/i,
    });
    await user.click(within(chorus).getByRole("button", { name: /shape idea/i }));
    await user.click(screen.getByRole("button", { name: "Craft guide" }));

    expect(
      screen.getByRole("heading", {
        name: /tiktok · choose one defensible point of view/i,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /reel · open on the useful contrast/i }),
    ).not.toBeInTheDocument();
  });

  it("moves craft context to the idea promoted from the Idea Board", async () => {
    const user = userEvent.setup();
    const state = useMuseboardStore.getState();
    state.shapeOpportunity(state.opportunities[0].id);
    state.shapeOpportunity(state.opportunities[1].id);
    state.selectOpportunity(state.opportunities[0].id);
    renderWorkspace("ideas");
    const chorus = screen.getByRole("article", {
      name: /build the chorus in public/i,
    });

    await user.click(
      within(chorus).getByRole("button", { name: /promote to workshop/i }),
    );
    await user.click(screen.getByRole("button", { name: "Craft guide" }));

    expect(
      screen.getByRole("heading", {
        name: /tiktok · choose one defensible point of view/i,
      }),
    ).toBeVisible();
    expect(useMuseboardStore.getState().selectedOpportunityId).toBe(
      state.opportunities[1].id,
    );
  });
});

describe("Vision board integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("validates HTTPS, MIME, hash, rights, and the local 2GB quota", () => {
    expect(
      validateVisionReference({
        kind: "url",
        title: "Unsafe reference",
        url: "http://example.com/reference",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        sha256: validHash,
        rightsStatus: "owned",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/https/i) });

    expect(
      validateVisionReference({
        kind: "file",
        title: "Executable",
        fileName: "idea.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 12,
        sha256: "not-a-hash",
        rightsStatus: "owned",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/type|hash/i) });

    expect(
      validateVisionReference(
        {
          kind: "file",
          title: "Too large",
          fileName: "reference.mp4",
          mimeType: "video/mp4",
          sizeBytes: 2,
          sha256: validHash,
          rightsStatus: "licensed",
        },
        VISION_WORKSPACE_QUOTA_BYTES - 1,
      ),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/2gb|quota/i) });

    expect(
      validateVisionReference({
        kind: "url",
        title: "Unverified rights",
        url: "https://example.com/reference",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        sha256: validHash,
        rightsStatus: "pirated" as never,
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/rights/i) });

    expect(
      validateVisionReference({
        kind: "url",
        title: "Normalized hash",
        url: "https://example.com/normalized",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        sha256: `  ${"A".repeat(64)}  `,
        rightsStatus: "owned",
      }),
    ).toMatchObject({ ok: true, input: { sha256: validHash } });

    expect(
      validateVisionReference({
        kind: "file",
        title: "Oversized image metadata",
        fileName: "large.png",
        mimeType: "image/png",
        sizeBytes: VISION_IMAGE_PDF_MAX_BYTES + 1,
        sha256: validHash,
        rightsStatus: "owned",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/25 mb/i) });
  });

  it("preflights picked files before reading bytes", async () => {
    const user = userEvent.setup();
    render(<VisionBoardView />);
    await user.click(screen.getByRole("radio", { name: /file metadata/i }));
    const picker = screen.getByLabelText(/choose local file/i);
    const unsupported = new File(["binary"], "unsafe.exe", {
      type: "application/x-msdownload",
    });
    const arrayBuffer = vi.fn();
    Object.defineProperty(unsupported, "arrayBuffer", { value: arrayBuffer });

    fireEvent.change(picker, { target: { files: [unsupported] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/supported/i);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /add reference metadata/i }),
    ).toBeDisabled();
  });

  it.each([
    ["large.png", "image/png", VISION_IMAGE_PDF_MAX_BYTES + 1, /25 mb/i],
    ["large.mp4", "video/mp4", VISION_VIDEO_MAX_BYTES + 1, /250 mb/i],
  ])("rejects %s before hashing", async (name, type, size, message) => {
    const user = userEvent.setup();
    const hashFile = vi.fn<VisionFileHasher>();
    render(<VisionBoardView hashFile={hashFile} />);
    await user.click(screen.getByRole("radio", { name: /file metadata/i }));
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });

    fireEvent.change(screen.getByLabelText(/choose local file/i), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(hashFile).not.toHaveBeenCalled();
  });

  it("rejects a picked file beyond the remaining 2GB quota before hashing", async () => {
    const user = userEvent.setup();
    const hashFile = vi.fn<VisionFileHasher>();
    useMuseboardStore.setState({
      visionReferences: [
        {
          id: "reference-quota",
          kind: "file",
          title: "Existing metadata",
          fileName: "existing.mp4",
          mimeType: "video/mp4",
          sizeBytes: VISION_WORKSPACE_QUOTA_BYTES - 5,
          sha256: "b".repeat(64),
          rightsStatus: "owned",
          addedAt: "2026-07-13T09:00:00.000Z",
          provenance: { provider: "museboard-local", mode: "sample" },
        },
      ],
    });
    render(<VisionBoardView hashFile={hashFile} />);
    await user.click(screen.getByRole("radio", { name: /file metadata/i }));
    const file = new File(["ten-bytes"], "small.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText(/choose local file/i), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/remaining.*2gb|quota/i);
    expect(hashFile).not.toHaveBeenCalled();
  });

  it("keeps only the latest selected file hash when digests finish out of order", async () => {
    const user = userEvent.setup();
    const pending = new Map<string, (value: string) => void>();
    const hashFile: VisionFileHasher = vi.fn(
      (file) =>
        new Promise<string>((resolve) => {
          pending.set(file.name, resolve);
        }),
    );
    render(<VisionBoardView hashFile={hashFile} />);
    await user.click(screen.getByRole("radio", { name: /file metadata/i }));
    const picker = screen.getByLabelText(/choose local file/i);
    const hashField = screen.getByRole("textbox", { name: /content hash/i });
    const add = screen.getByRole("button", { name: /add reference metadata/i });
    const fileA = new File(["a"], "a.png", { type: "image/png" });
    const fileB = new File(["b"], "b.png", { type: "image/png" });

    fireEvent.change(picker, { target: { files: [fileA] } });
    expect(hashField).toHaveValue("");
    expect(add).toBeDisabled();
    fireEvent.change(picker, { target: { files: [fileB] } });
    expect(hashField).toHaveValue("");
    expect(add).toBeDisabled();
    expect(hashFile).toHaveBeenCalledTimes(2);

    const resolveB = pending.get("b.png");
    expect(resolveB).toBeTypeOf("function");
    await act(async () => resolveB?.("B".repeat(64)));
    await waitFor(() => expect(hashField).toHaveValue("b".repeat(64)));
    expect(add).toBeEnabled();

    const resolveA = pending.get("a.png");
    expect(resolveA).toBeTypeOf("function");
    await act(async () => resolveA?.("A".repeat(64)));
    expect(hashField).toHaveValue("b".repeat(64));
    expect(screen.getByRole("status")).toHaveTextContent(/b\.png.*prepared locally/i);
  });

  it("clears a prior digest and error as soon as a replacement file is picked", async () => {
    const user = userEvent.setup();
    let resolveReplacement: ((value: string) => void) | undefined;
    const hashFile: VisionFileHasher = vi
      .fn()
      .mockResolvedValueOnce("a".repeat(64))
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveReplacement = resolve;
          }),
      );
    render(<VisionBoardView hashFile={hashFile} />);
    await user.click(screen.getByRole("radio", { name: /file metadata/i }));
    const picker = screen.getByLabelText(/choose local file/i);
    const hashField = screen.getByRole("textbox", { name: /content hash/i });
    const add = screen.getByRole("button", { name: /add reference metadata/i });

    fireEvent.change(picker, {
      target: { files: [new File(["a"], "a.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(hashField).toHaveValue("a".repeat(64)));

    fireEvent.change(picker, {
      target: {
        files: [
          new File(["bad"], "bad.exe", {
            type: "application/x-msdownload",
          }),
        ],
      },
    });
    expect(hashField).toHaveValue("");
    expect(await screen.findByRole("alert")).toHaveTextContent(/supported/i);

    fireEvent.change(picker, {
      target: { files: [new File(["b"], "b.png", { type: "image/png" })] },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(hashField).toHaveValue("");
    expect(add).toBeDisabled();

    await act(async () => resolveReplacement?.("b".repeat(64)));
    await waitFor(() => expect(hashField).toHaveValue("b".repeat(64)));
  });

  it("stores a whitespace-padded uppercase SHA-256 in canonical form without throwing", () => {
    const add = () =>
      useMuseboardStore.getState().addVisionReference({
        kind: "url",
        title: "Canonical hash",
        url: "https://example.com/canonical",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        sha256: ` ${"A".repeat(64)} `,
        rightsStatus: "owned",
      });

    expect(add).not.toThrow();
    expect(add()).toMatchObject({ ok: true });
    expect(useMuseboardStore.getState().visionReferences[0].sha256).toBe(
      validHash,
    );
  });

  it("adds only metadata, reuses duplicates, explicitly selects strategy inputs, and returns to empty", async () => {
    const user = userEvent.setup();
    renderWorkspace("vision");

    expect(screen.getByText(/no references yet/i)).toBeVisible();
    expect(screen.getByText(/local metadata only/i)).toBeVisible();

    await user.type(
      screen.getByRole("textbox", { name: /reference title/i }),
      "Warm editorial pacing",
    );
    await user.type(
      screen.getByRole("textbox", { name: /reference url/i }),
      "http://example.com/reference",
    );
    await user.type(
      screen.getByRole("textbox", { name: /content hash/i }),
      validHash,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /rights status/i }),
      "owned",
    );
    await user.click(
      screen.getByRole("button", { name: /add reference metadata/i }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/https/i);

    const url = screen.getByRole("textbox", { name: /reference url/i });
    await user.clear(url);
    await user.type(url, "https://example.com/reference");
    await user.click(
      screen.getByRole("button", { name: /add reference metadata/i }),
    );
    expect(screen.getByText(/no file or media was uploaded/i)).toBeVisible();

    expect(
      useMuseboardStore.getState().addVisionReference({
        kind: "url",
        title: "Unsafe duplicate",
        url: "http://example.com/unsafe",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        sha256: validHash,
        rightsStatus: "owned",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/https/i) });

    const reference = screen.getByRole("article", {
      name: /warm editorial pacing/i,
    });
    await user.click(
      within(reference).getByRole("checkbox", { name: /use in strategy/i }),
    );
    expect(useMuseboardStore.getState().selectedReferenceIds).toEqual([
      useMuseboardStore.getState().visionReferences[0].id,
    ]);

    await user.click(
      screen.getByRole("button", { name: /add reference metadata/i }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/reused existing/i);
    expect(useMuseboardStore.getState().visionReferences).toHaveLength(1);

    await user.click(
      within(reference).getByRole("button", { name: /remove reference/i }),
    );
    expect(screen.getByText(/no references yet/i)).toBeVisible();
    expect(useMuseboardStore.getState().selectedReferenceIds).toEqual([]);
  });
});

describe("Curated operator contract and craft guidance", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects copied bodies and invalid expiry before producing the exact preview", () => {
    const baseDraft = {
      title: "A useful public signal",
      summary: "Turn a public platform change into one practical creator lesson.",
      platform: "youtube_shorts" as const,
      archetypes: ["tech_education" as const],
      format: "tutorial" as const,
      pillar: "Useful concepts made clear",
      readiness: "shape" as const,
      goal: "trust" as const,
      geography: "Global",
      signals: {
        relevance: 88,
        momentum: 80,
        originality: 74,
        creatorFit: 91,
      },
      sourceClass: "official_platform" as const,
      sourceLabel: "YouTube Creators",
      sourceUrl: "https://support.google.com/youtube/",
      observedAt: "2026-07-13T06:00:00.000Z",
      expiresAt: "2026-07-14T06:00:00.000Z",
      evidenceSummary: "The public product note creates a teachable workflow change.",
    };

    expect(
      previewCuratedOpportunity(
        { ...baseDraft, articleBody: "copied article" },
        "2026-07-13T09:00:00.000Z",
      ),
    ).toMatchObject({ ok: false });
    expect(
      previewCuratedOpportunity(
        { ...baseDraft, sourceClass: "scraped_article" },
        "2026-07-13T09:00:00.000Z",
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/official_platform|public_research/i),
    });
    expect(
      previewCuratedOpportunity(
        {
          ...baseDraft,
          expiresAt: "2026-07-13T05:00:00.000Z",
        },
        "2026-07-13T09:00:00.000Z",
      ),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/expiry/i) });
    expect(
      previewCuratedOpportunity(baseDraft, "2026-07-13T09:00:00.000Z"),
    ).toMatchObject({
      ok: true,
      opportunity: {
        title: baseDraft.title,
        summary: baseDraft.summary,
        provenance: {
          sourceLabel: baseDraft.sourceLabel,
          sourceUrl: baseDraft.sourceUrl,
        },
      },
    });
  });

  it("keeps the unlinked ingestion console owner-only and previews the same opportunity component", async () => {
    const user = userEvent.setup();
    render(<OwnerOpportunityConsole />);

    expect(screen.getByText(/owner-only operator view/i)).toBeVisible();
    expect(screen.getByText(/no ingestion endpoint is connected/i)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /preview exact opportunity/i }),
    );
    expect(
      screen.getByRole("region", { name: /exact for you preview/i }),
    ).toContainElement(
      screen.getByRole("article", { name: /public product note/i }),
    );
  });

  it("checks operator expiry against the current clock rather than the demo clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00.000Z"));
    render(<OwnerOpportunityConsole />);

    fireEvent.click(
      screen.getByRole("button", { name: /preview exact opportunity/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/expiry/i);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("seeds exactly 24 provenance-bearing guides and returns no more than two contextual matches", () => {
    expect(CRAFT_GUIDES).toHaveLength(24);
    expect(
      CRAFT_GUIDES.every(
        ({ provenance }) =>
          provenance.source.length > 0 && provenance.reviewedAt.length > 0,
      ),
    ).toBe(true);
    expect(CRAFT_GUIDES.every(({ formats }) => formats.length === 1)).toBe(true);
    expect(
      CRAFT_GUIDES.every(({ creatorStages }) => creatorStages.length === 1),
    ).toBe(true);

    const matches = matchCraftGuides(CRAFT_GUIDES, {
      stage: "hook",
      platform: "instagram_reels",
      format: "tutorial",
      creatorStage: "starter",
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(2);
    expect(
      matches.every(
        (guide) =>
          guide.stage === "hook" &&
          guide.platform === "instagram_reels" &&
          guide.formats.includes("tutorial") &&
          guide.creatorStages.includes("starter"),
      ),
    ).toBe(true);
  });
});
