import { z } from "zod";

import {
  OPPORTUNITY_FORMATS,
  VISION_REFERENCE_KINDS,
  VISION_RIGHTS_STATUSES,
  ideaRecordSchema,
  opportunityFormatSchema,
  opportunityGoalSchema,
  opportunityReadinessSchema,
  opportunitySchema,
  opportunitySourceClassSchema,
  rankOpportunity,
  type IdeaRecord,
  type Opportunity,
  type OpportunityFormat,
  type VisionReference,
  type VisionReferenceKind,
  type VisionRightsStatus,
} from "@/domain/opportunities";
import {
  contentPlatformSchema,
  creatorArchetypeSchema,
  type ContentPlatform,
  type CreatorArchetype,
  type WorkflowStage,
} from "@/domain/schema";

export { rankOpportunity };

export const VISION_WORKSPACE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const ALLOWED_VISION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
] as const;

export interface OpportunityProviderContext {
  archetypes: CreatorArchetype[];
  platforms: ContentPlatform[];
  geography: string;
  now: string;
}

export interface OpportunityProvider {
  readonly id: string;
  readonly mode: "sample" | "curated" | "live";
  list(context: OpportunityProviderContext): Promise<Opportunity[]>;
}

export class LocalSampleOpportunityProvider implements OpportunityProvider {
  readonly id = "museboard-local-sample";
  readonly mode = "sample" as const;

  constructor(private readonly opportunities: Opportunity[]) {}

  async list(context: OpportunityProviderContext): Promise<Opportunity[]> {
    return this.opportunities.filter(
      ({ archetypes, platform, provenance }) =>
        context.platforms.includes(platform) &&
        archetypes.some((archetype) =>
          context.archetypes.includes(archetype),
        ) &&
        new Date(provenance.expiresAt).getTime() >
          new Date(context.now).getTime(),
    );
  }
}

export interface VisionReferenceInput {
  kind: VisionReferenceKind;
  title: string;
  url?: string;
  fileName?: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  rightsStatus: VisionRightsStatus;
}

export type VisionValidationResult =
  | { ok: true; input: VisionReferenceInput }
  | { ok: false; error: string };

function isAllowedMimeType(value: string): boolean {
  return (ALLOWED_VISION_MIME_TYPES as readonly string[]).includes(value);
}

export function canonicalizeReferenceUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return undefined;
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function validateVisionReference(
  payload: VisionReferenceInput,
  usedBytes = 0,
): VisionValidationResult {
  const title = payload.title.trim();
  if (!title) return { ok: false, error: "Add a reference title." };
  if (!(VISION_REFERENCE_KINDS as readonly string[]).includes(payload.kind)) {
    return { ok: false, error: "Choose URL or file metadata." };
  }
  if (
    !(VISION_RIGHTS_STATUSES as readonly string[]).includes(
      payload.rightsStatus,
    )
  ) {
    return { ok: false, error: "Choose a valid rights status." };
  }
  if (payload.kind === "url" && !canonicalizeReferenceUrl(payload.url ?? "")) {
    return { ok: false, error: "Use an HTTPS URL for web references." };
  }
  if (payload.kind === "file" && !payload.fileName?.trim()) {
    return { ok: false, error: "Choose a file before adding its metadata." };
  }
  if (!isAllowedMimeType(payload.mimeType)) {
    return {
      ok: false,
      error: "This file type is not supported. Use an image, video, or PDF.",
    };
  }
  if (!Number.isSafeInteger(payload.sizeBytes) || payload.sizeBytes < 0) {
    return { ok: false, error: "Reference size must be valid metadata." };
  }
  if (!/^[a-f\d]{64}$/iu.test(payload.sha256.trim())) {
    return { ok: false, error: "Content hash must be a 64-character SHA-256." };
  }
  if (usedBytes + payload.sizeBytes > VISION_WORKSPACE_QUOTA_BYTES) {
    return {
      ok: false,
      error: "This exceeds the 2GB sample workspace metadata quota.",
    };
  }
  return {
    ok: true,
    input: {
      ...payload,
      title,
      url:
        payload.kind === "url"
          ? canonicalizeReferenceUrl(payload.url ?? "")
          : undefined,
      fileName:
        payload.kind === "file" ? payload.fileName?.trim() : undefined,
      sha256: payload.sha256.toLocaleLowerCase(),
    },
  };
}

export function findDuplicateReference(
  references: VisionReference[],
  input: VisionReferenceInput,
): VisionReference | undefined {
  const canonicalUrl = input.url
    ? canonicalizeReferenceUrl(input.url)
    : undefined;
  return references.find(
    (reference) =>
      reference.sha256.toLocaleLowerCase() ===
        input.sha256.toLocaleLowerCase() ||
      (canonicalUrl !== undefined &&
        canonicalizeReferenceUrl(reference.url ?? "") === canonicalUrl),
  );
}

export function createIdeaFromOpportunity(
  opportunity: Opportunity,
  at: string,
): IdeaRecord {
  return ideaRecordSchema.parse({
    id: `idea-${opportunity.id}`,
    opportunityId: opportunity.id,
    title: opportunity.title,
    summary: opportunity.summary,
    platform: opportunity.platform,
    format: opportunity.format,
    pillar: opportunity.pillar,
    readiness: opportunity.readiness,
    goal: opportunity.goal,
    createdAt: at,
    provenance: {
      opportunityId: opportunity.id,
      provider: opportunity.provenance.provider,
      mode: opportunity.provenance.mode,
      sourceUrl: opportunity.provenance.sourceUrl,
    },
  });
}

const curatedOpportunitySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(280),
    platform: contentPlatformSchema,
    archetypes: z.array(creatorArchetypeSchema).min(1),
    format: opportunityFormatSchema,
    pillar: z.string().trim().min(1).max(80),
    readiness: opportunityReadinessSchema,
    goal: opportunityGoalSchema,
    geography: z.string().trim().min(1).max(80),
    signals: z.object({
      relevance: z.number().min(0).max(100),
      momentum: z.number().min(0).max(100),
      originality: z.number().min(0).max(100),
      creatorFit: z.number().min(0).max(100),
    }),
    sourceClass: opportunitySourceClassSchema,
    sourceLabel: z.string().trim().min(1).max(100),
    sourceUrl: z
      .url()
      .refine((url) => url.startsWith("https://"), "Use an HTTPS source URL"),
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    evidenceSummary: z.string().trim().min(1).max(280),
  })
  .strict();

function stablePreviewId(title: string): string {
  const slug = title
    .toLocaleLowerCase()
    .replace(/[^a-z\d]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  return `preview-${slug || "opportunity"}`;
}

export type CuratedPreviewResult =
  | { ok: true; opportunity: Opportunity }
  | { ok: false; error: string };

export function previewCuratedOpportunity(
  payload: unknown,
  now: string,
): CuratedPreviewResult {
  const parsed = curatedOpportunitySchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid opportunity metadata." };
  }
  const observedAt = new Date(parsed.data.observedAt).getTime();
  const expiresAt = new Date(parsed.data.expiresAt).getTime();
  const current = new Date(now).getTime();
  if (expiresAt <= observedAt || expiresAt <= current) {
    return {
      ok: false,
      error: "Expiry must be later than both observation time and the preview time.",
    };
  }

  const opportunity = opportunitySchema.parse({
    id: stablePreviewId(parsed.data.title),
    title: parsed.data.title,
    summary: parsed.data.summary,
    platform: parsed.data.platform,
    archetypes: parsed.data.archetypes,
    format: parsed.data.format,
    pillar: parsed.data.pillar,
    readiness: parsed.data.readiness,
    goal: parsed.data.goal,
    geography: parsed.data.geography,
    signals: parsed.data.signals,
    evidence: [
      {
        summary: parsed.data.evidenceSummary,
        sourceLabel: parsed.data.sourceLabel,
      },
    ],
    provenance: {
      provider: "museboard-curated-preview",
      mode: "curated",
      fetchedAt: now,
      sourceClass: parsed.data.sourceClass,
      sourceLabel: parsed.data.sourceLabel,
      sourceUrl: parsed.data.sourceUrl,
      observedAt: parsed.data.observedAt,
      expiresAt: parsed.data.expiresAt,
    },
  });
  return { ok: true, opportunity };
}

export const CREATOR_STAGES = ["starter", "growing", "established"] as const;
export type CreatorStage = (typeof CREATOR_STAGES)[number];

export interface CraftGuide {
  id: string;
  title: string;
  guidance: string;
  stage: Exclude<WorkflowStage, "published" | "measured" | "archived">;
  platform: ContentPlatform;
  formats: OpportunityFormat[];
  creatorStages: CreatorStage[];
  provenance: {
    source: string;
    author: string;
    reviewedAt: string;
  };
}

export interface CraftGuideContext {
  stage: CraftGuide["stage"];
  platform: ContentPlatform;
  format: OpportunityFormat;
  creatorStage: CreatorStage;
}

const GUIDE_STAGES = [
  "signal",
  "angle",
  "hook",
  "outline",
  "script",
  "shoot",
  "review",
  "ready",
] as const;

const platformGuideNames: Record<ContentPlatform, string> = {
  instagram_reels: "Reel",
  tiktok_video: "TikTok",
  youtube_shorts: "Short",
};

const stageGuideCopy: Record<(typeof GUIDE_STAGES)[number], [string, string]> = {
  signal: [
    "Name the audience tension",
    "Write the change in one sentence before deciding what to make.",
  ],
  angle: [
    "Choose one defensible point of view",
    "Narrow the signal to a claim your own experience can support.",
  ],
  hook: [
    "Open on the useful contrast",
    "Let the first line reveal the before-and-after, not a vague promise.",
  ],
  outline: [
    "Build one clean progression",
    "Move from tension to proof to one action without adding a second lesson.",
  ],
  script: [
    "Read for spoken rhythm",
    "Replace written transitions with the words you naturally use aloud.",
  ],
  shoot: [
    "Protect the first readable frame",
    "Make the opening visual legible before motion or captions compete for attention.",
  ],
  review: [
    "Cut what the viewer already knows",
    "Remove repeated setup so the proof arrives while curiosity is still active.",
  ],
  ready: [
    "Check the promise against the delivery",
    "Confirm the caption and title describe the lesson the video actually gives.",
  ],
};

export const CRAFT_GUIDES: CraftGuide[] = (
  ["instagram_reels", "tiktok_video", "youtube_shorts"] as const
).flatMap((platform) =>
  GUIDE_STAGES.map((stage) => ({
    id: `craft-${platform}-${stage}`,
    title: `${platformGuideNames[platform]} · ${stageGuideCopy[stage][0]}`,
    guidance: stageGuideCopy[stage][1],
    stage,
    platform,
    formats: [...OPPORTUNITY_FORMATS],
    creatorStages: [...CREATOR_STAGES],
    provenance: {
      source: "Museboard Craft Desk",
      author: "Editorial practice team",
      reviewedAt: "2026-07-01",
    },
  })),
);

export function matchCraftGuides(
  guides: CraftGuide[],
  context: CraftGuideContext,
): CraftGuide[] {
  return guides
    .filter(
      (guide) =>
        guide.stage === context.stage &&
        guide.platform === context.platform &&
        guide.formats.includes(context.format) &&
        guide.creatorStages.includes(context.creatorStage),
    )
    .slice(0, 2);
}
