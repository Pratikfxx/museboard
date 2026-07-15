import { describe, expect, it } from "vitest";

import { createVoiceRewrite } from "@/lib/providers/voice-rewrite";

const input = {
  contentId: "content-1",
  versionId: "content-1-v1",
  script: "This game-changing system fixes your whole workflow. Rebuild everything today.",
  voiceTraits: ["warm", "practical", "direct"],
  boundaries: ["No hype", "No unrealistic overnight results"],
  memory: {
    version: 3,
    preferredPhrases: ["Here is the useful part"],
    avoidPhrases: ["game-changing", "rebuild everything"],
    preferredStructures: ["Name the tension, show the reset, offer one action"],
    notes: ["Keep claims grounded in lived experience"],
    updatedAt: "2026-07-15T10:00:00.000Z",
  },
  target: { platform: "youtube_shorts" as const, format: "tutorial" },
};

describe("voice rewrite", () => {
  it("uses the current memory while removing avoided language and recording provenance", () => {
    const result = createVoiceRewrite(input, () => new Date("2026-07-15T11:00:00.000Z"));

    expect(result.rewrittenScript).toMatch(/^Here is the useful part/u);
    expect(result.rewrittenScript).not.toMatch(/game-changing|rebuild everything/iu);
    expect(result.rewrittenScript).not.toBe(input.script);
    expect(result.appliedMemory).toMatchObject({
      version: 3,
      preferredPhrases: ["Here is the useful part"],
      avoidedPhrases: ["game-changing", "rebuild everything"],
    });
    expect(result.provenance).toMatchObject({
      provider: "museboard-local-voice",
      model: "deterministic-voice-rewriter-v1",
      promptVersion: "voice-rewrite-v1",
      voiceProfileVersion: "memory-v3",
      generatedAt: "2026-07-15T11:00:00.000Z",
      mode: "sample",
    });
  });

  it("keeps a useful manual-review warning when memory is sparse", () => {
    const result = createVoiceRewrite({
      ...input,
      memory: {
        ...input.memory,
        preferredPhrases: [],
        avoidPhrases: [],
        preferredStructures: [],
        notes: [],
      },
    });

    expect(result.warnings).toContain("Creator Memory is sparse. Review the preview closely before saving it.");
    expect(result.rewrittenScript.trim()).not.toHaveLength(0);
  });

  it("does not claim an avoided phrase was removed when it was not present", () => {
    const result = createVoiceRewrite({
      ...input,
      memory: {
        ...input.memory,
        avoidPhrases: ["a phrase that is not in the draft"],
      },
    });

    expect(result.appliedMemory.avoidedPhrases).toEqual([]);
    expect(result.changes.join(" ")).not.toMatch(/removed/i);
  });
});
