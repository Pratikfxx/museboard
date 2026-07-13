import JSZip from "jszip";
import { z } from "zod";

import type { Approval, ContentItem, ContentPlatform, ContentVersion } from "@/domain/schema";
import { contentItemSchema, contentPlatformSchema } from "@/domain/schema";

export const MAX_EXPORT_BYTES = 500 * 1024 * 1024;
export const MAX_ASSET_BYTES = 250 * 1024 * 1024;

export interface ExportFileDescriptor {
  name: string;
  mediaType: string;
  sha256: string;
  bytes: number;
}

export interface ExportManifest {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  contentId: string;
  versionId: string;
  variantId: string;
  platform: ContentPlatform;
  generatedAt: string;
  requestedAt: string;
  requestedBy: string;
  approvalId?: string;
  approvalStatus: Approval["status"] | "unapproved";
  rightsStatus: "cleared" | "references_only";
  disclosures: string[];
  validation: { status: "passed"; excludedAssetReferences: string[] };
  files: ExportFileDescriptor[];
}

export interface ExportRecord {
  id: string;
  contentId: string;
  versionId: string;
  variantId: string;
  platform: ContentPlatform;
  filename: string;
  generatedAt: string;
  manifestSha256: string;
  manifest: ExportManifest;
  status: "complete";
}

export interface ExportAssetSnapshot {
  name: string;
  mediaType: string;
  bytes: number;
  rightsStatus: "owned" | "licensed" | "unknown";
  contentBase64?: string;
  reference?: string;
}

export interface ExportSnapshot {
  organizationId: string;
  requestedBy: string;
  generatedAt: string;
  content: ContentItem;
  versionId: string;
  platform: ContentPlatform;
  approvalId?: string;
  assets?: ExportAssetSnapshot[];
}

export interface BuiltExportPackage {
  filename: string;
  zip: Uint8Array;
  manifest: ExportManifest;
  manifestSha256: string;
}

const assetSnapshotSchema: z.ZodType<ExportAssetSnapshot> = z.object({
  name: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  bytes: z.number().int().nonnegative().max(MAX_ASSET_BYTES),
  rightsStatus: z.enum(["owned", "licensed", "unknown"]),
  contentBase64: z.string().optional(),
  reference: z.string().optional(),
});

export const exportSnapshotSchema: z.ZodType<ExportSnapshot> = z.object({
  organizationId: z.string().trim().min(1),
  requestedBy: z.string().trim().min(1),
  generatedAt: z.iso.datetime(),
  content: contentItemSchema,
  versionId: z.string().min(1),
  platform: contentPlatformSchema,
  approvalId: z.string().min(1).optional(),
  assets: z.array(assetSnapshotSchema).optional(),
});

export const exportManifestSchema: z.ZodType<ExportManifest> = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  organizationId: z.string().min(1),
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  variantId: z.string().min(1),
  platform: contentPlatformSchema,
  generatedAt: z.iso.datetime(),
  requestedAt: z.iso.datetime(),
  requestedBy: z.string().min(1),
  approvalId: z.string().min(1).optional(),
  approvalStatus: z.enum(["pending", "approved", "changes_requested", "stale", "unapproved"]),
  rightsStatus: z.enum(["cleared", "references_only"]),
  disclosures: z.array(z.string()),
  validation: z.object({
    status: z.literal("passed"),
    excludedAssetReferences: z.array(z.string()),
  }),
  files: z.array(z.object({
    name: z.string().min(1),
    mediaType: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    bytes: z.number().int().nonnegative(),
  })),
});

export const exportRecordSchema: z.ZodType<ExportRecord> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  variantId: z.string().min(1),
  platform: contentPlatformSchema,
  filename: z.string().endsWith(".zip"),
  generatedAt: z.iso.datetime(),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  manifest: exportManifestSchema,
  status: z.literal("complete"),
});

function lf(value: string): string {
  return `${value.replace(/\r\n?/gu, "\n").replace(/\n+$/u, "")}\n`;
}

function safeSlug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "").slice(0, 56) || "creator-pack";
}

function platformSlug(platform: ContentPlatform): string {
  return platform.replaceAll("_", "-");
}

function platformName(platform: ContentPlatform): string {
  return ({ instagram_reels: "Instagram Reels", tiktok_video: "TikTok", youtube_shorts: "YouTube Shorts" })[platform];
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function currentVersion(snapshot: ExportSnapshot): ContentVersion {
  const version = snapshot.content.versions.find(({ id }) => id === snapshot.versionId);
  if (!version) throw new Error("The selected content version no longer exists.");
  if (snapshot.content.platform !== snapshot.platform) throw new Error("The export platform must match this content variant.");
  if (!version.script.trim()) throw new Error("Add a script before creating the package.");
  return version;
}

function contractFiles(snapshot: ExportSnapshot, version: ContentVersion, excluded: string[]): Record<string, string> {
  const platform = platformName(snapshot.platform);
  const hook = version.selectedHookText?.trim() || "Opening hook not set";
  const caption = version.platformVariants?.[snapshot.platform]?.trim() || `${hook}\n\n${version.angle}`;
  const shots = version.shotList?.length ? version.shotList : ["Opening detail", "Creator to camera", "Closing proof"];
  const referenceNotes = excluded.length ? `\nReferences excluded from the ZIP because ownership or reuse rights were not confirmed:\n${excluded.map((entry) => `- ${entry}`).join("\n")}\n` : "";
  const platformGuidance = {
    instagram_reels: "Finish audio, cover frame, collaborator tags, and safe-zone review in Instagram.",
    tiktok_video: "Finish sounds, text timing, disclosure controls, and cover selection in TikTok.",
    youtube_shorts: "Finish title, thumbnail frame, audience setting, and checks in YouTube Studio.",
  }[snapshot.platform];
  const metadata = {
    schemaVersion: 1,
    platform: snapshot.platform,
    title: snapshot.content.title,
    hook,
    caption,
    aspectRatio: "9:16",
    safeZone: "Keep essential text and faces away from the top 14% and bottom 20% UI zones.",
    disclosureReminder: "Confirm sponsorship, synthetic-media, and AI-label requirements before publishing.",
    audioRights: excluded.length ? "references_only" : "creator_confirmed_or_none",
    nativeFinish: platformGuidance,
  };
  return {
    "README.md": lf(`# ${snapshot.content.title}\n\nPackage for ${platform}, version ${version.number}.\n\n## Native finish\n\n${platformGuidance}\n\n## Format\n\n- 9:16 vertical\n- Keep key text clear of platform UI safe zones\n- Recheck audio rights and disclosures at publish time\n${referenceNotes}`),
    "caption.txt": lf(caption),
    "script.md": lf(`# Script\n\n**Hook:** ${hook}\n\n${version.script}`),
    "shot-list.csv": lf(`order,shot,status\n${shots.map((shot, index) => `${index + 1},${JSON.stringify(shot)},planned`).join("\n")}`),
    "publish-checklist.md": lf(`# Publish checklist\n\n- [ ] Review the 9:16 crop and safe zones\n- [ ] Confirm caption, CTA, and destination links\n- [ ] Confirm audio and media rights\n- [ ] Add sponsorship / AI disclosures when required\n- [ ] Finish native ${platform} settings\n- [ ] Copy the published HTTPS post URL back into Museboard`),
    [`metadata/${platformSlug(snapshot.platform)}.json`]: lf(JSON.stringify(metadata, null, 2)),
  };
}

export async function buildExportPackage(payload: unknown): Promise<BuiltExportPackage> {
  const snapshot = exportSnapshotSchema.parse(payload);
  const version = currentVersion(snapshot);
  const excluded = [
    ...(version.assets ?? []),
    ...(snapshot.assets ?? []).filter(({ rightsStatus, contentBase64 }) => rightsStatus === "unknown" || !contentBase64).map(({ name, reference }) => reference ? `${name} — ${reference}` : name),
  ];
  const ownedAssets = (snapshot.assets ?? []).filter(({ rightsStatus, contentBase64 }) => rightsStatus !== "unknown" && Boolean(contentBase64));
  for (const asset of ownedAssets) {
    const actualBytes = Uint8Array.from(atob(asset.contentBase64!), (character) => character.charCodeAt(0));
    if (actualBytes.byteLength !== asset.bytes) throw new Error(`${asset.name} size does not match its upload metadata.`);
    if (actualBytes.byteLength > MAX_ASSET_BYTES) throw new Error(`${asset.name} is larger than the 250MB per-asset limit.`);
  }
  const textFiles = contractFiles(snapshot, version, excluded);
  const entries: Array<{ name: string; mediaType: string; bytes: Uint8Array }> = Object.entries(textFiles).map(([name, content]) => ({
    name,
    mediaType: name.endsWith(".json") ? "application/json" : name.endsWith(".csv") ? "text/csv" : name.endsWith(".txt") ? "text/plain" : "text/markdown",
    bytes: encode(content),
  }));
  for (const asset of ownedAssets) {
    entries.push({
      name: `assets/${asset.name.replaceAll("/", "-")}`,
      mediaType: asset.mediaType,
      bytes: Uint8Array.from(atob(asset.contentBase64!), (character) => character.charCodeAt(0)),
    });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const entryNames = entries.map(({ name }) => name.toLocaleLowerCase());
  if (new Set(entryNames).size !== entryNames.length) throw new Error("Two export files resolve to the same package name.");
  const totalUncompressed = entries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  if (totalUncompressed > MAX_EXPORT_BYTES) throw new Error("This package exceeds the 500MB export limit.");
  const approvalStatus = snapshot.content.approval?.versionId === version.id ? snapshot.content.approval.status : "unapproved";
  const fileDescriptors = await Promise.all(entries.map(async (entry) => ({
    name: entry.name,
    mediaType: entry.mediaType,
    sha256: await sha256(entry.bytes),
    bytes: entry.bytes.byteLength,
  })));
  const variantId = `${snapshot.content.id}-${snapshot.platform}-${version.id}`;
  const manifest: ExportManifest = exportManifestSchema.parse({
    schemaVersion: 1,
    id: `export-${variantId}-${snapshot.generatedAt.replace(/[^0-9]/gu, "")}`,
    organizationId: snapshot.organizationId,
    contentId: snapshot.content.id,
    versionId: version.id,
    variantId,
    platform: snapshot.platform,
    generatedAt: snapshot.generatedAt,
    requestedAt: snapshot.generatedAt,
    requestedBy: snapshot.requestedBy,
    approvalId: snapshot.approvalId,
    approvalStatus,
    rightsStatus: excluded.length ? "references_only" : "cleared",
    disclosures: ["Review native platform disclosures before publishing.", "No external media was downloaded from reference links."],
    validation: { status: "passed", excludedAssetReferences: excluded },
    files: fileDescriptors,
  });
  const manifestContent = lf(JSON.stringify(manifest, null, 2));
  const manifestSha256 = await sha256(encode(manifestContent));
  const zip = new JSZip();
  const zipDate = new Date(snapshot.generatedAt);
  for (const entry of entries) zip.file(entry.name, Array.from(entry.bytes), { date: zipDate, createFolders: false });
  zip.file("manifest.json", manifestContent, { date: zipDate });
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });
  if (bytes.byteLength > MAX_EXPORT_BYTES) throw new Error("This package exceeds the 500MB export limit after assembly.");
  return {
    filename: `museboard-${safeSlug(snapshot.content.title)}-${platformSlug(snapshot.platform)}-${snapshot.generatedAt.slice(0, 10)}-v${version.number}.zip`,
    zip: bytes,
    manifest,
    manifestSha256,
  };
}

export async function validateExportZip(bytes: ArrayBuffer | Uint8Array): Promise<{ manifest: ExportManifest; manifestSha256: string }> {
  const zip = await JSZip.loadAsync(bytes);
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("The package is missing manifest.json.");
  const manifestText = await manifestEntry.async("text");
  const manifest = exportManifestSchema.parse(JSON.parse(manifestText));
  for (const expected of manifest.files) {
    const entry = zip.file(expected.name);
    if (!entry) throw new Error(`The package is missing ${expected.name}.`);
    const fileBytes = await entry.async("uint8array");
    if (fileBytes.byteLength !== expected.bytes || await sha256(fileBytes) !== expected.sha256) {
      throw new Error(`${expected.name} failed package integrity validation.`);
    }
  }
  return { manifest, manifestSha256: await sha256(encode(manifestText)) };
}

export function buildExportManifest(item: ContentItem, options: { requestedAt: string; requestedBy: string }): ExportManifest {
  const version = item.versions.find((candidate) => candidate.id === item.currentVersionId);
  if (!version) throw new Error("Cannot export a missing content version");
  const approvalStatus = item.approval?.versionId === item.currentVersionId ? item.approval.status : "unapproved";
  return {
    schemaVersion: 1,
    id: `export-${version.id}`,
    organizationId: "sample-workspace",
    contentId: item.id,
    versionId: version.id,
    variantId: `${item.id}-${item.platform}-${version.id}`,
    platform: item.platform,
    generatedAt: options.requestedAt,
    requestedAt: options.requestedAt,
    requestedBy: options.requestedBy,
    approvalStatus,
    rightsStatus: version.assets?.length ? "references_only" : "cleared",
    disclosures: ["Review native platform disclosures before publishing."],
    validation: { status: "passed", excludedAssetReferences: version.assets ?? [] },
    files: [],
  };
}
