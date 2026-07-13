import { z } from "zod";

export const WORKFLOW_STAGES = [
  "signal",
  "angle",
  "hook",
  "outline",
  "script",
  "shoot",
  "review",
  "ready",
  "published",
  "measured",
  "archived",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const CONTENT_PLATFORMS = [
  "instagram_reels",
  "tiktok_video",
  "youtube_shorts",
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const CREATOR_ARCHETYPES = [
  "music",
  "tech_education",
  "lifestyle_business",
] as const;

export type CreatorArchetype = (typeof CREATOR_ARCHETYPES)[number];
export type DataMode = "sample" | "curated" | "live";

export interface ContentEvidence {
  id: string;
  label: string;
  summary: string;
  url?: string;
  attached: boolean;
}

export interface GenerationProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  voiceProfileVersion: string;
  opportunityId?: string;
  evidenceIds: string[];
  generatedAt: string;
  latencyMs: number;
  outputSchemaVersion: string;
  mode: "sample" | "live";
}

export interface ContentVersion {
  id: string;
  contentId: string;
  number: number;
  angle: string;
  selectedHookId?: string;
  selectedHookText?: string;
  evidence?: ContentEvidence[];
  outline?: string[];
  script: string;
  shotList?: string[];
  assets?: string[];
  sourceRequiredClaims?: string[];
  platformVariants?: Partial<Record<ContentPlatform, string>>;
  generationProvenance?: GenerationProvenance;
  createdAt: string;
}

export interface Approval {
  status: "pending" | "approved" | "changes_requested" | "stale";
  versionId: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  platform: ContentPlatform;
  archetype: CreatorArchetype;
  stage: WorkflowStage;
  currentVersionId: string;
  versions: ContentVersion[];
  approval?: Approval;
  opportunityId?: string;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HookOption {
  id: string;
  contentId: string;
  text: string;
  rationale: string;
}

export interface Comment {
  id: string;
  contentId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface PublishReceipt {
  id: string;
  contentId: string;
  platform: ContentPlatform;
  externalPostId?: string;
  publishedAt: string;
  recordedAt: string;
  provenance: {
    provider: string;
    mode: DataMode;
    sourceUrl?: string;
  };
}

export interface Learning {
  id: string;
  metricKey: string;
  metricDefinition: string;
  platform: ContentPlatform;
  statement: string;
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  includedContentIds: string[];
  dismissedAt?: string;
}

export const workflowStageSchema = z.enum(WORKFLOW_STAGES);
export const contentPlatformSchema = z.enum(CONTENT_PLATFORMS);
export const creatorArchetypeSchema = z.enum(CREATOR_ARCHETYPES);
export const dataModeSchema = z.enum(["sample", "curated", "live"]);

export const contentVersionSchema: z.ZodType<ContentVersion> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  number: z.number().int().positive(),
  angle: z.string(),
  selectedHookId: z.string().min(1).optional(),
  selectedHookText: z.string().optional(),
  evidence: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        summary: z.string().min(1),
        url: z.url().optional(),
        attached: z.boolean(),
      }),
    )
    .optional(),
  outline: z.array(z.string().min(1)).optional(),
  script: z.string(),
  shotList: z.array(z.string().min(1)).optional(),
  assets: z.array(z.string().min(1)).optional(),
  sourceRequiredClaims: z.array(z.string().min(1)).optional(),
  platformVariants: z.record(contentPlatformSchema, z.string()).optional(),
  generationProvenance: z
    .object({
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
    })
    .optional(),
  createdAt: z.iso.datetime(),
});

export const approvalSchema: z.ZodType<Approval> = z.object({
  status: z.enum(["pending", "approved", "changes_requested", "stale"]),
  versionId: z.string().min(1),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.iso.datetime().optional(),
});

export const contentItemSchema: z.ZodType<ContentItem> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: contentPlatformSchema,
  archetype: creatorArchetypeSchema,
  stage: workflowStageSchema,
  currentVersionId: z.string().min(1),
  versions: z.array(contentVersionSchema).min(1),
  approval: approvalSchema.optional(),
  opportunityId: z.string().min(1).optional(),
  scheduledFor: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const hookOptionSchema: z.ZodType<HookOption> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  text: z.string().min(1),
  rationale: z.string().min(1),
});

export const commentSchema: z.ZodType<Comment> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  author: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const publishReceiptSchema: z.ZodType<PublishReceipt> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  platform: contentPlatformSchema,
  externalPostId: z.string().min(1).optional(),
  publishedAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  provenance: z.object({
    provider: z.string().min(1),
    mode: dataModeSchema,
    sourceUrl: z.url().optional(),
  }),
});

export const learningSchema: z.ZodType<Learning> = z.object({
  id: z.string().min(1),
  metricKey: z.string().min(1),
  metricDefinition: z.string().min(1),
  platform: contentPlatformSchema,
  statement: z.string().min(1),
  sampleSize: z.number().int().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  includedContentIds: z.array(z.string().min(1)),
  dismissedAt: z.iso.datetime().optional(),
});
