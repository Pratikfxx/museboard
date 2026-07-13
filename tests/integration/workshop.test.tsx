import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkshopWorkspace } from "@/components/workshop/workshop-workspace";
import type { EntitlementDecision } from "@/domain/entitlements";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import {
  StrategistProvider,
  strategistRequestSchema,
  type StrategistQuota,
  type StrategistTransport,
} from "@/lib/providers/strategist";
import { useMuseboardStore } from "@/lib/store/museboard-store";

const generatedAt = "2026-07-13T09:05:00.000Z";

function activateWorkshop() {
  const workspace = buildStarterWorkspace({
    outcome: "build_system",
    archetype: "tech_education",
    audience: "Independent creators building calmer publishing systems",
    platforms: ["youtube_shorts"],
    weeklyCapacityMinutes: 240,
    voice: "Warm, candid, and precise",
    boundaries: "No unsupported performance claims",
    firstHook: "Your content calendar is not the system.",
  });
  useMuseboardStore.getState().completeOnboarding(workspace);
  return workspace.content[0].id;
}

function renderWorkshop(options?: { stage?: "hook" | "outline" | "script"; voiceMode?: boolean }) {
  const contentId = activateWorkshop();
  return {
    contentId,
    ...render(
      <WorkshopWorkspace
        contentId={contentId}
        initialStage={options?.stage}
        voiceMode={options?.voiceMode}
      />,
    ),
  };
}

function request() {
  return strategistRequestSchema.parse({
    schemaVersion: "1.0",
    creatorGoal: "Build a calm weekly publishing system",
    nicheArchetypes: ["tech_education"],
    audience: "Independent creators",
    selectedPillar: "Calm systems",
    opportunityId: "opportunity-1",
    evidenceIds: ["evidence-1"],
    voice: { version: "voice-v1", traits: ["warm", "precise"] },
    boundaries: ["No unsupported claims"],
    target: { platform: "youtube_shorts", format: "tutorial" },
    currentStage: "hook",
    previousCreatorEdits: ["Keep the opening plain-spoken"],
  });
}

function quotaHarness(): {
  quota: StrategistQuota;
  events: string[];
} {
  const events: string[] = [];
  return {
    events,
    quota: {
      reserve: () => {
        events.push("reserve");
        return { allowed: true, remaining: 1 } satisfies EntitlementDecision;
      },
      commit: () => events.push("commit"),
      release: () => events.push("release"),
    },
  };
}

describe("content workshop", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("keeps the complete editorial spine, evidence, manual editor, and contextual guidance visible", () => {
    renderWorkshop();

    const spine = screen.getByRole("navigation", { name: /workshop stages/i });
    for (const stage of [
      "Evidence",
      "Angle",
      "Hooks",
      "Outline",
      "Script",
      "Shoot",
      "Review",
      "Ready",
    ]) {
      expect(within(spine).getByRole("button", { name: new RegExp(stage, "i") })).toBeVisible();
    }
    expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /manual hook edit/i })).toBeVisible();
    expect(screen.getByRole("complementary", { name: /craft guidance/i })).toBeVisible();
    expect(screen.getByText(/saved to this browser · no server sync/i)).toBeVisible();
  });

  it("chooses a hook and advances with one immutable version append", async () => {
    const user = userEvent.setup();
    const { contentId } = renderWorkshop();
    const before = useMuseboardStore.getState().content[0];
    const originalVersion = structuredClone(before.versions[0]);

    await user.click(screen.getByRole("radio", { name: /plain-spoken/i }));
    await user.click(screen.getByRole("button", { name: /use this hook/i }));

    const active = useMuseboardStore.getState().content.find(({ id }) => id === contentId)!;
    expect(active.stage).toBe("outline");
    expect(active.versions).toHaveLength(before.versions.length + 1);
    expect(active.versions[0]).toEqual(originalVersion);
    expect(active.versions.at(-1)?.selectedHookId).toBeTruthy();
    expect(screen.getByRole("heading", { name: /shape the outline/i })).toBeVisible();
    expect(screen.getByText(/version 2/i)).toBeVisible();
  });

  it("autosaves a manual outline as one new version with visible status", async () => {
    vi.useFakeTimers();
    const { contentId } = renderWorkshop({ stage: "outline" });
    const beforeCount = useMuseboardStore.getState().content[0].versions.length;
    const editor = screen.getByRole("textbox", { name: /outline beats/i });

    fireEvent.change(editor, {
      target: { value: "Name the tension\nShow the reset\nInvite one small action" },
    });
    expect(screen.getByText(/^saving/i)).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(550);
    });

    expect(screen.getByText(/^saved/i)).toBeVisible();
    const active = useMuseboardStore.getState().content.find(({ id }) => id === contentId)!;
    expect(active.versions).toHaveLength(beforeCount + 1);
    expect(active.versions.at(-1)?.outline).toEqual([
      "Name the tension",
      "Show the reset",
      "Invite one small action",
    ]);
    expect(active.versions[0].outline).toBeUndefined();
    vi.useRealTimers();
  });

  it("opens voice mode with an explanation while leaving manual script editing available", () => {
    renderWorkshop({ stage: "script", voiceMode: true });

    expect(screen.getByRole("heading", { name: /rewrite in your voice/i })).toBeVisible();
    expect(screen.getByText(/uses only the voice traits you confirmed/i)).toBeVisible();
    expect(screen.getByText(/warm, candid, precise/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /script draft/i })).toBeEnabled();
    expect(screen.getByText(/manual editing stays unlimited/i)).toBeVisible();
  });

  it("blocks Ready for source-required claims until evidence is attached", async () => {
    const user = userEvent.setup();
    const { contentId } = renderWorkshop({ stage: "script" });
    useMuseboardStore.getState().saveWorkshopVersion({
      contentId,
      patch: {
        evidence: [],
        sourceRequiredClaims: ["This workflow doubles publishing speed."],
      },
      at: "2026-07-13T09:10:00.000Z",
    });

    await user.click(screen.getByRole("button", { name: /^ready/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/attach evidence/i);
    expect(useMuseboardStore.getState().content[0].stage).not.toBe("ready");
    expect(screen.getByRole("button", { name: /continue manually/i })).toBeVisible();
  });
});

describe("StrategistProvider", () => {
  it("returns a deterministic, explicitly sample result with complete provenance and charges only after validation", async () => {
    const { quota, events } = quotaHarness();
    const provider = new StrategistProvider({
      quota,
      now: () => new Date(generatedAt).getTime(),
    });

    const first = await provider.generatePack(request());
    const second = await provider.generatePack(request());

    expect(first.mode).toBe("sample");
    expect(first.hooks).toHaveLength(3);
    expect(second.hooks).toEqual(first.hooks);
    expect(first.provenance).toMatchObject({
      provider: "museboard-local-sample",
      model: "deterministic-strategist-v1",
      promptVersion: "strategist-pack-v1",
      voiceProfileVersion: "voice-v1",
      opportunityId: "opportunity-1",
      evidenceIds: ["evidence-1"],
      outputSchemaVersion: "1.0",
      generatedAt,
    });
    expect(first.provenance.inputHash).toMatch(/^[a-f\d]{8}$/u);
    expect(first.provenance.latencyMs).toBeGreaterThanOrEqual(0);
    expect(events).toEqual(["reserve", "commit", "reserve", "commit"]);
  });

  it("releases quota for invalid results and cancellation", async () => {
    const invalidQuota = quotaHarness();
    const invalidTransport: StrategistTransport = {
      id: "invalid-live-provider",
      model: "invalid-model",
      mode: "live",
      generate: async () => ({ hooks: [] }),
    };
    const invalidProvider = new StrategistProvider({
      quota: invalidQuota.quota,
      transport: invalidTransport,
    });

    await expect(invalidProvider.generatePack(request())).rejects.toThrow(/valid strategist result/i);
    expect(invalidQuota.events).toEqual(["reserve", "release"]);

    const cancelQuota = quotaHarness();
    const waitingTransport: StrategistTransport = {
      id: "waiting-provider",
      model: "waiting-model",
      mode: "live",
      generate: (_request, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    };
    const controller = new AbortController();
    const waitingProvider = new StrategistProvider({
      quota: cancelQuota.quota,
      transport: waitingTransport,
      timeoutMs: 25_000,
    });
    const pending = waitingProvider.generatePack(request(), { signal: controller.signal });
    controller.abort(new DOMException("Cancelled by creator", "AbortError"));

    await expect(pending).rejects.toThrow(/cancelled/i);
    expect(cancelQuota.events).toEqual(["reserve", "release"]);
  });
});
