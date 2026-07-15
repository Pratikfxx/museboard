import { z } from "zod";

import { creatorMemorySchema, type CreatorMemory } from "@/domain/creator-intelligence";
import {
  contentPlatformSchema,
  type ContentPlatform,
  type GenerationProvenance,
} from "@/domain/schema";

export const voiceRewriteRequestSchema = z.object({
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  script: z.string().trim().min(1),
  voiceTraits: z.array(z.string().trim().min(1)).min(1),
  boundaries: z.array(z.string().trim().min(1)),
  memory: creatorMemorySchema,
  target: z.object({
    platform: contentPlatformSchema,
    format: z.string().trim().min(1),
  }),
});

export interface VoiceRewriteRequest {
  contentId: string;
  versionId: string;
  script: string;
  voiceTraits: string[];
  boundaries: string[];
  memory: CreatorMemory;
  target: { platform: ContentPlatform; format: string };
}

export interface VoiceRewriteResult {
  originalScript: string;
  rewrittenScript: string;
  changes: string[];
  warnings: string[];
  appliedMemory: {
    version: number;
    preferredPhrases: string[];
    avoidedPhrases: string[];
    preferredStructures: string[];
    notes: string[];
    voiceTraits: string[];
    boundaries: string[];
  };
  provenance: GenerationProvenance;
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function removeAvoidedPhrases(script: string, phrases: string[]): string {
  return phrases.reduce(
    (draft, phrase) => draft.replace(new RegExp(escapeRegExp(phrase), "giu"), ""),
    script,
  )
    .replace(/\s+([,.;!?])/gu, "$1")
    .replace(/\s{2,}/gu, " ")
    .replace(/([.!?])(?=\p{L})/gu, "$1 ")
    .trim();
}

export function createVoiceRewrite(
  payload: VoiceRewriteRequest,
  now: () => Date = () => new Date(),
): VoiceRewriteResult {
  const request = voiceRewriteRequestSchema.parse(payload);
  const removedPhrases = request.memory.avoidPhrases.filter((phrase) =>
    new RegExp(escapeRegExp(phrase), "iu").test(request.script),
  );
  const sanitized = removeAvoidedPhrases(
    request.script,
    removedPhrases,
  );
  const preferredLead = request.memory.preferredPhrases[0];
  const rewrittenScript = preferredLead && !sanitized.toLocaleLowerCase().startsWith(preferredLead.toLocaleLowerCase())
    ? `${preferredLead}.\n\n${sanitized}`
    : sanitized;
  const changes = [
    ...(removedPhrases.length
      ? [`Removed ${removedPhrases.length} avoided phrase${removedPhrases.length === 1 ? "" : "s"}.`]
      : []),
    ...(preferredLead ? [`Opened with “${preferredLead}”.`] : []),
    ...(request.memory.preferredStructures[0]
      ? [`Used “${request.memory.preferredStructures[0]}” as the review structure.`]
      : []),
  ];
  const memoryIsSparse =
    request.memory.preferredPhrases.length === 0 &&
    request.memory.avoidPhrases.length === 0 &&
    request.memory.preferredStructures.length === 0 &&
    request.memory.notes.length === 0;
  const generatedAt = now().toISOString();

  return {
    originalScript: request.script,
    rewrittenScript,
    changes,
    warnings: memoryIsSparse
      ? ["Creator Memory is sparse. Review the preview closely before saving it."]
      : [],
    appliedMemory: {
      version: request.memory.version,
      preferredPhrases: request.memory.preferredPhrases,
      avoidedPhrases: removedPhrases,
      preferredStructures: request.memory.preferredStructures,
      notes: request.memory.notes,
      voiceTraits: request.voiceTraits,
      boundaries: request.boundaries,
    },
    provenance: {
      provider: "museboard-local-voice",
      model: "deterministic-voice-rewriter-v1",
      promptVersion: "voice-rewrite-v1",
      inputHash: stableHash(JSON.stringify(request)),
      voiceProfileVersion: `memory-v${request.memory.version}`,
      evidenceIds: [],
      generatedAt,
      latencyMs: 0,
      outputSchemaVersion: "1.0",
      mode: "sample",
    },
  };
}
