import { z } from "zod";

import type { EntitlementDecision } from "@/domain/entitlements";
import {
  contentPlatformSchema,
  creatorArchetypeSchema,
  type GenerationProvenance,
} from "@/domain/schema";

const strategistStageSchema = z.enum([
  "signal",
  "evidence",
  "angle",
  "hook",
  "outline",
  "script",
  "shoot",
  "review",
  "ready",
]);

export const strategistRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    creatorGoal: z.string().trim().min(1),
    nicheArchetypes: z.array(creatorArchetypeSchema).min(1),
    audience: z.string().trim().min(1),
    selectedPillar: z.string().trim().min(1),
    opportunityId: z.string().trim().min(1).optional(),
    evidenceIds: z.array(z.string().trim().min(1)),
    voice: z.object({
      version: z.string().trim().min(1),
      traits: z.array(z.string().trim().min(1)).min(1),
    }),
    boundaries: z.array(z.string().trim().min(1)),
    target: z.object({
      platform: contentPlatformSchema,
      format: z.string().trim().min(1),
    }),
    currentStage: strategistStageSchema,
    previousCreatorEdits: z.array(z.string()),
  })
  .strict();

const strategistBodySchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    angles: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(1),
          promiseLabel: z.string().min(1),
        }),
      )
      .min(2)
      .refine(
        (angles) => new Set(angles.map(({ text }) => text.trim().toLocaleLowerCase())).size === angles.length,
        "Angles must be distinct",
      ),
    hooks: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(1),
          strategy: z.string().min(1),
          promiseLabel: z.string().min(1),
        }),
      )
      .length(3),
    outlineBeats: z.array(z.string().min(1)).min(3),
    script: z.string().min(1),
    sourceReferences: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        url: z.url().optional(),
        attached: z.boolean(),
      }),
    ),
    safety: z.object({
      rightsFlags: z.array(z.string().min(1)),
      sourceRequiredClaims: z.array(z.string().min(1)),
    }),
  })
  .strict();

export const strategistResultSchema = strategistBodySchema.extend({
  mode: z.enum(["sample", "live"]),
  provenance: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    promptVersion: z.string().min(1),
    inputHash: z.string().min(1),
    voiceProfileVersion: z.string().min(1),
    opportunityId: z.string().min(1).optional(),
    evidenceIds: z.array(z.string().min(1)),
    generatedAt: z.iso.datetime(),
    latencyMs: z.number().nonnegative(),
    outputSchemaVersion: z.string().min(1),
    mode: z.enum(["sample", "live"]),
  }),
});

export type StrategistRequest = z.infer<typeof strategistRequestSchema>;
export type StrategistResult = z.infer<typeof strategistResultSchema>;

export interface StrategistQuota {
  reserve: () => EntitlementDecision;
  commit: () => void;
  release: () => void;
}

export interface StrategistTransport {
  readonly id: string;
  readonly model: string;
  readonly mode: "sample" | "live";
  generate: (
    request: StrategistRequest,
    context: { signal: AbortSignal },
  ) => Promise<unknown>;
}

interface StrategistProviderOptions {
  transport?: StrategistTransport;
  quota?: StrategistQuota;
  timeoutMs?: number;
  now?: () => number;
}

const unmeteredQuota: StrategistQuota = {
  reserve: () => ({ allowed: true }),
  commit: () => undefined,
  release: () => undefined,
};

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function deterministicBody(request: StrategistRequest) {
  const audience = request.audience.replace(/[.!?]+$/u, "");
  const pillar = request.selectedPillar.replace(/[.!?]+$/u, "");
  const evidenceLabel = request.evidenceIds[0] ?? "creator-evidence";
  return {
    schemaVersion: "1.0" as const,
    angles: [
      {
        id: "angle-practice",
        text: `Show ${audience} the smallest useful practice inside ${pillar}.`,
        promiseLabel: "One practical shift",
      },
      {
        id: "angle-contrast",
        text: `Contrast the noisy default with a calmer ${pillar.toLocaleLowerCase()} ritual.`,
        promiseLabel: "A clear before and after",
      },
    ],
    hooks: [
      {
        id: "hook-plain-spoken",
        text: `The hard part is not ${pillar.toLocaleLowerCase()}. It is making room to begin.`,
        strategy: "Plain-spoken contrast",
        promiseLabel: "Names the real friction",
      },
      {
        id: "hook-specific",
        text: "Here is the ten-minute reset I use before I make anything.",
        strategy: "Specific ritual",
        promiseLabel: "A bounded walkthrough",
      },
      {
        id: "hook-invitation",
        text: "Try this before you rebuild your whole content system.",
        strategy: "Low-pressure invitation",
        promiseLabel: "One reversible experiment",
      },
    ],
    outlineBeats: [
      "Name the familiar friction without exaggerating it.",
      "Demonstrate one creator-owned practice as evidence.",
      "Invite one small action the audience can adapt.",
    ],
    script: `Your content calendar is not the whole system. Start with one repeatable moment: clear the surface, name the next useful idea, and record the first honest line. Keep what helps; leave the rest.`,
    sourceReferences: request.evidenceIds.map((id) => ({
      id,
      label: id === evidenceLabel ? "Selected opportunity evidence" : "Creator evidence",
      attached: true,
    })),
    safety: {
      rightsFlags: ["Use only creator-owned or rights-cleared visuals."],
      sourceRequiredClaims: request.nicheArchetypes.includes("tech_education")
        ? ["Attach a source before making measurable performance claims."]
        : [],
    },
  };
}

const localSampleTransport: StrategistTransport = {
  id: "museboard-local-sample",
  model: "deterministic-strategist-v1",
  mode: "sample",
  generate: async (request) => deterministicBody(request),
};

export class StrategistProvider {
  private readonly transport: StrategistTransport;
  private readonly quota: StrategistQuota;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(options: StrategistProviderOptions = {}) {
    this.transport = options.transport ?? localSampleTransport;
    this.quota = options.quota ?? unmeteredQuota;
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.now = options.now ?? Date.now;
  }

  async generatePack(
    payload: StrategistRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<StrategistResult> {
    const request = strategistRequestSchema.parse(payload);
    const decision = this.quota.reserve();
    if (!decision.allowed) {
      throw new Error(`Strategist pack limit reached. Resets ${decision.resetAt}.`);
    }

    const startedAt = this.now();
    const controller = new AbortController();
    let timedOut = false;
    let committed = false;
    const onExternalAbort = () => {
      controller.abort(new DOMException("Strategist request cancelled.", "AbortError"));
    };
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Strategist request timed out.", "TimeoutError"));
    }, this.timeoutMs);

    try {
      const output = await Promise.race([
        this.transport.generate(request, { signal: controller.signal }),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true },
          );
        }),
      ]);
      const body = strategistBodySchema.safeParse(output);
      if (!body.success) {
        throw new Error("Provider did not return a valid strategist result.");
      }

      const finishedAt = this.now();
      const provenance: GenerationProvenance = {
        provider: this.transport.id,
        model: this.transport.model,
        promptVersion: "strategist-pack-v1",
        inputHash: stableHash(JSON.stringify(request)),
        voiceProfileVersion: request.voice.version,
        opportunityId: request.opportunityId,
        evidenceIds: request.evidenceIds,
        generatedAt: new Date(finishedAt).toISOString(),
        latencyMs: Math.max(0, finishedAt - startedAt),
        outputSchemaVersion: body.data.schemaVersion,
        mode: this.transport.mode,
      };
      const result = strategistResultSchema.parse({
        ...body.data,
        mode: this.transport.mode,
        provenance,
      });
      this.quota.commit();
      committed = true;
      return result;
    } catch (error) {
      if (!committed) this.quota.release();
      if (timedOut) {
        throw new Error(`Strategist request timed out after ${this.timeoutMs / 1000} seconds.`);
      }
      if (options.signal?.aborted || controller.signal.aborted) {
        throw new Error("Strategist request cancelled. Your draft was preserved.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
