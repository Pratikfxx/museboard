import { z } from "zod";

import type { Approval, ContentItem, ContentPlatform } from "@/domain/schema";
import { contentPlatformSchema } from "@/domain/schema";

export interface ExportFile {
  name: "caption.txt" | "script.txt" | "manifest.json";
  mediaType: "text/plain" | "application/json";
  content: string;
}

export interface ExportManifest {
  id: string;
  contentId: string;
  versionId: string;
  platform: ContentPlatform;
  requestedAt: string;
  requestedBy: string;
  approvalStatus: Approval["status"] | "unapproved";
  files: ExportFile[];
}

export const exportManifestSchema: z.ZodType<ExportManifest> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  platform: contentPlatformSchema,
  requestedAt: z.iso.datetime(),
  requestedBy: z.string().min(1),
  approvalStatus: z.enum([
    "pending",
    "approved",
    "changes_requested",
    "stale",
    "unapproved",
  ]),
  files: z.array(
    z.object({
      name: z.enum(["caption.txt", "script.txt", "manifest.json"]),
      mediaType: z.enum(["text/plain", "application/json"]),
      content: z.string(),
    }),
  ),
});

export function buildExportManifest(
  item: ContentItem,
  options: { requestedAt: string; requestedBy: string },
): ExportManifest {
  const version = item.versions.find(
    (candidate) => candidate.id === item.currentVersionId,
  );
  if (!version) throw new Error("Cannot export a missing content version");

  const approvalStatus =
    item.approval?.versionId === item.currentVersionId
      ? item.approval.status
      : "unapproved";
  const metadata = {
    contentId: item.id,
    versionId: version.id,
    platform: item.platform,
    approvalStatus,
    requestedAt: options.requestedAt,
  };

  return {
    id: `export-${version.id}`,
    contentId: item.id,
    versionId: version.id,
    platform: item.platform,
    requestedAt: options.requestedAt,
    requestedBy: options.requestedBy,
    approvalStatus,
    files: [
      {
        name: "caption.txt",
        mediaType: "text/plain",
        content: `${item.title}\n\n${version.angle}`,
      },
      { name: "script.txt", mediaType: "text/plain", content: version.script },
      {
        name: "manifest.json",
        mediaType: "application/json",
        content: JSON.stringify(metadata, null, 2),
      },
    ],
  };
}
