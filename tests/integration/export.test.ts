import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildExportPackage, MAX_ASSET_BYTES, validateExportZip } from "@/domain/export";
import { createDemoState } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import instagramFixture from "../fixtures/exports/instagram/expected.json";
import tiktokFixture from "../fixtures/exports/tiktok/expected.json";
import youtubeFixture from "../fixtures/exports/youtube/expected.json";
import type { ContentPlatform } from "@/domain/schema";

function snapshot(overrides: Record<string, unknown> = {}) {
  const state = createDemoState();
  const content = structuredClone(state.content[0]);
  content.versions[0].shotList = ["Hands clear the desk", "Creator explains the reset"];
  content.versions[0].assets = ["Trending audio link — rights unknown"];
  return { organizationId: "org-sample", requestedBy: "Maya Chen", generatedAt: "2026-07-13T12:34:56.000Z", content, versionId: content.currentVersionId, platform: content.platform, ...overrides };
}

describe("platform export package", () => {
  it("assembles the exact contract and validates every manifest hash", async () => {
    const built = await buildExportPackage(snapshot());
    const zip = await JSZip.loadAsync(built.zip);
    expect(Object.values(zip.files).filter(({ dir }) => !dir).map(({ name }) => name).sort()).toEqual([
      "README.md", "caption.txt", "manifest.json", "metadata/instagram-reels.json", "publish-checklist.md", "script.md", "shot-list.csv",
    ]);
    expect(Object.values(zip.files).filter(({ dir }) => dir)).toHaveLength(0);
    expect(built.manifest.files.every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256))).toBe(true);
    await expect(validateExportZip(built.zip)).resolves.toMatchObject({ manifest: { validation: { status: "passed" } } });
    for (const fixture of [instagramFixture, tiktokFixture, youtubeFixture]) {
      const base = snapshot();
      const platform = fixture.platform as ContentPlatform;
      const target = await buildExportPackage({ ...base, platform, content: { ...base.content, platform } });
      const targetZip = await JSZip.loadAsync(target.zip);
      expect(targetZip.file(fixture.metadata)).toBeTruthy();
      expect(await targetZip.file("README.md")!.async("text")).toContain(fixture.nativeFinish);
    }
  });

  it("is byte-for-byte deterministic for the same explicit snapshot", async () => {
    const first = await buildExportPackage(snapshot());
    const second = await buildExportPackage(snapshot());
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
    expect(first.manifestSha256).toBe(second.manifestSha256);
  });

  it("keeps unknown-rights references in README but out of assets", async () => {
    const built = await buildExportPackage(snapshot());
    const zip = await JSZip.loadAsync(built.zip);
    expect(Object.keys(zip.files).some((name) => name.startsWith("assets/"))).toBe(false);
    expect(await zip.file("README.md")!.async("text")).toContain("rights unknown");
    expect(built.manifest.rightsStatus).toBe("references_only");
  });

  it("uses collision-safe export IDs and rejects oversized assets", async () => {
    const first = await buildExportPackage(snapshot());
    const later = await buildExportPackage(snapshot({ generatedAt: "2026-07-13T12:34:57.000Z" }));
    expect(first.manifest.id).not.toBe(later.manifest.id);
    await expect(buildExportPackage(snapshot({ assets: [{ name: "huge.mov", mediaType: "video/quicktime", bytes: MAX_ASSET_BYTES + 1, rightsStatus: "owned" }] }))).rejects.toThrow();

    useMuseboardStore.getState().resetDemo();
    const record = { id: first.manifest.id, contentId: first.manifest.contentId, versionId: first.manifest.versionId, variantId: first.manifest.variantId, platform: first.manifest.platform, filename: first.filename, generatedAt: first.manifest.generatedAt, manifestSha256: first.manifestSha256, manifest: first.manifest, status: "complete" as const };
    expect(useMuseboardStore.getState().recordExport({ ...record, versionId: "tampered" })).toBe(false);
    expect(useMuseboardStore.getState().recordExport(record)).toBe(true);
    useMuseboardStore.getState().saveWorkshopVersion({ contentId: "content-desk", patch: { angle: "A later version" }, at: "2026-07-13T13:00:00.000Z" });
    expect(useMuseboardStore.getState().recordPublishReceipt({ id: "bad-host", exportId: record.id, versionId: record.versionId, contentId: record.contentId, platform: record.platform, publishedAt: "2026-07-13T14:00:00.000Z", recordedAt: "2026-07-13T14:01:00.000Z", provenance: { provider: "manual-unverified", mode: "sample", sourceUrl: "https://tiktok.com/@x/video/1" } })).toBe(false);
    expect(useMuseboardStore.getState().recordPublishReceipt({ id: "receipt-v1", exportId: record.id, versionId: record.versionId, contentId: record.contentId, platform: record.platform, publishedAt: "2026-07-13T14:00:00.000Z", recordedAt: "2026-07-13T14:01:00.000Z", provenance: { provider: "manual-unverified", mode: "sample", sourceUrl: "https://instagram.com/reel/demo" } })).toBe(true);
    expect(useMuseboardStore.getState().content[0].stage).not.toBe("published");
  });
});
