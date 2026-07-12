import { describe, expect, it } from "vitest";

import type { ContentItem } from "@/domain/schema";
import { buildExportManifest } from "@/domain/export";
import { transitionStage } from "@/domain/workflow";

const approvedItem: ContentItem = {
  id: "content-1",
  title: "Build a tiny studio",
  platform: "instagram_reels",
  archetype: "tech_education",
  stage: "review",
  currentVersionId: "content-1-v1",
  versions: [
    {
      id: "content-1-v1",
      contentId: "content-1",
      number: 1,
      angle: "A calm desk is a creative advantage",
      selectedHookId: "hook-1",
      script: "Start with the desk you already have.",
      createdAt: "2026-07-13T09:00:00.000Z",
    },
  ],
  approval: {
    status: "approved",
    versionId: "content-1-v1",
    approvedAt: "2026-07-13T10:00:00.000Z",
  },
  createdAt: "2026-07-13T09:00:00.000Z",
  updatedAt: "2026-07-13T10:00:00.000Z",
};

describe("transitionStage", () => {
  it("marks a version-bound approval stale after an approved hook is edited", () => {
    const edited = transitionStage(approvedItem, {
      type: "EDIT",
      field: "hook",
      value: "hook-2",
      at: "2026-07-13T11:00:00.000Z",
    });

    expect(edited.approval?.status).toBe("stale");
    expect(edited.currentVersionId).toBe("content-1-v2");
    expect(edited.versions.at(-1)?.selectedHookId).toBe("hook-2");
    expect(approvedItem.approval?.status).toBe("approved");
    expect(approvedItem.versions).toHaveLength(1);
  });

  it("moves a content item without mutating its prior stage", () => {
    const moved = transitionStage(approvedItem, {
      type: "MOVE",
      stage: "ready",
      at: "2026-07-13T11:00:00.000Z",
    });

    expect(moved.stage).toBe("ready");
    expect(moved.updatedAt).toBe("2026-07-13T11:00:00.000Z");
    expect(approvedItem.stage).toBe("review");
  });

  it("binds exports to the approved current version", () => {
    const manifest = buildExportManifest(approvedItem, {
      requestedAt: "2026-07-13T11:30:00.000Z",
      requestedBy: "Aarav",
    });

    expect(manifest.versionId).toBe("content-1-v1");
    expect(manifest.approvalStatus).toBe("approved");
    expect(manifest.files.map((file) => file.name)).toEqual([
      "caption.txt",
      "script.txt",
      "manifest.json",
    ]);
  });
});
