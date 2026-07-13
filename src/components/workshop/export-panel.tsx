"use client";

import { ArrowSquareOut, CheckCircle, Copy, DownloadSimple, Info, ShareNetwork, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { validateExportZip, type ExportRecord } from "@/domain/export";
import type { ContentItem } from "@/domain/schema";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./export-panel.module.css";

const platformLanding = { instagram_reels: "https://www.instagram.com/", tiktok_video: "https://www.tiktok.com/upload", youtube_shorts: "https://studio.youtube.com/" };

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

export function ExportPanel({ item }: { item: ContentItem }) {
  const creator = useMuseboardStore((state) => state.creator);
  const allExports = useMuseboardStore((state) => state.exports);
  const allReceipts = useMuseboardStore((state) => state.publishReceipts);
  const allApprovals = useMuseboardStore((state) => state.approvals);
  const exports = useMemo(() => allExports.filter(({ contentId }) => contentId === item.id), [allExports, item.id]);
  const receipts = useMemo(() => allReceipts.filter(({ contentId }) => contentId === item.id), [allReceipts, item.id]);
  const approvals = useMemo(() => allApprovals.filter(({ contentId }) => contentId === item.id), [allApprovals, item.id]);
  const recordExport = useMuseboardStore((state) => state.recordExport);
  const recordPublishReceipt = useMuseboardStore((state) => state.recordPublishReceipt);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Your package is assembled from an explicit version snapshot and checked before download.");
  const [error, setError] = useState("");
  const [packageBlob, setPackageBlob] = useState<{ blob: Blob; exportId: string }>();
  const [activeExportId, setActiveExportId] = useState(exports.at(-1)?.id ?? "");
  const [postUrl, setPostUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const currentExport = useMemo(() => exports.find(({ id }) => id === activeExportId) ?? exports.at(-1), [activeExportId, exports]);
  const currentVersion = item.versions.find(({ id }) => id === item.currentVersionId)!;
  const outdated = exports.filter(({ versionId }) => versionId !== item.currentVersionId);
  const caption = currentVersion.platformVariants?.[item.platform] ?? `${currentVersion.selectedHookText ?? item.title}\n\n${currentVersion.angle}`;

  async function generatePackage() {
    setBusy(true); setError(""); setStatus("Assembling and validating package…");
    try {
      const generatedAt = new Date().toISOString();
      const response = await fetch(`/api/export/${item.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: "sample-workspace", requestedBy: creator?.name ?? "Workspace owner", generatedAt, content: item, versionId: item.currentVersionId, platform: item.platform, approvalId: [...approvals].reverse().find(({ versionId, status }) => versionId === item.currentVersionId && status === "approved")?.id }),
      });
      if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "The package could not be created."); }
      const blob = await response.blob();
      const validated = await validateExportZip(await blob.arrayBuffer());
      const filename = response.headers.get("X-Museboard-Filename") ?? `museboard-${item.id}.zip`;
      const record: ExportRecord = { id: validated.manifest.id, contentId: item.id, versionId: validated.manifest.versionId, variantId: validated.manifest.variantId, platform: validated.manifest.platform, filename, generatedAt: validated.manifest.generatedAt, manifestSha256: validated.manifestSha256, manifest: validated.manifest, status: "complete" };
      if (!recordExport(record)) throw new Error("The validated package record could not be saved.");
      setPackageBlob({ blob, exportId: record.id }); setActiveExportId(record.id);
      setStatus("Package validated and recorded. Download it, then finish native settings on the platform.");
      downloadBlob(blob, filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The package could not be created.");
      setStatus("Nothing was recorded or presented as complete.");
    } finally { setBusy(false); }
  }

  async function sharePackage() {
    if (!packageBlob || !currentExport || packageBlob.exportId !== currentExport.id) { setError("Generate this selected version again before sharing its local ZIP."); return; }
    const file = new File([packageBlob.blob], currentExport.filename, { type: "application/zip" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file], title: currentExport.filename }); return; } catch { /* Keep the download fallback. */ }
    }
    downloadBlob(packageBlob.blob, currentExport.filename);
    setStatus("Sharing is not available here, so the ZIP was downloaded. Save it, then open your platform app.");
  }

  function saveReceipt(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!currentExport) { setError("Create or select the exact export used for this post."); return; }
    let url: URL;
    try { url = new URL(postUrl); } catch { setError("Enter the full HTTPS URL for the published post."); return; }
    const publishedInstant = new Date(publishedAt);
    if (!Number.isFinite(publishedInstant.getTime())) { setError("Choose a valid published time."); return; }
    const ok = recordPublishReceipt({ id: `receipt-${currentExport.id}-${Date.now()}`, exportId: currentExport.id, versionId: currentExport.versionId, contentId: item.id, platform: currentExport.platform, externalPostId: url.pathname, publishedAt: publishedInstant.toISOString(), recordedAt: new Date().toISOString(), provenance: { provider: "manual-unverified", mode: "sample", sourceUrl: postUrl } });
    if (!ok) { setError("Use a unique HTTPS post URL and the export that was actually published."); return; }
    setPostUrl(""); setPublishedAt(""); setStatus("Manual unverified receipt recorded against the exact export and version.");
  }

  return (
    <section className={styles.panel} aria-labelledby="export-heading">
      <p className={styles.kicker}>Platform handoff</p><h2 id="export-heading">Package the work, then finish natively.</h2>
      <p className={styles.intro}>Museboard includes the caption, script, shot list, checklist, platform metadata, and a hashed manifest. Asset checklist text and unknown-rights references stay out of the ZIP.</p>
      {outdated.length ? <div className={styles.warning}><Warning aria-hidden="true" size={20} /><span>{outdated.length} earlier export{outdated.length === 1 ? " is" : "s are"} outdated because this draft has a newer version. They remain immutable.</span></div> : null}
      <div className={styles.actions}>
        <button className={styles.primary} disabled={busy} onClick={generatePackage} type="button"><DownloadSimple aria-hidden="true" size={19} />{busy ? "Building…" : "Download validated ZIP"}</button>
        <button disabled={!currentExport} onClick={sharePackage} type="button"><ShareNetwork aria-hidden="true" size={19} />Share / download</button>
        <button onClick={() => navigator.clipboard.writeText(caption)} type="button"><Copy aria-hidden="true" size={19} />Copy caption</button>
        <a href={platformLanding[item.platform]} rel="noreferrer" target="_blank">Open platform <ArrowSquareOut aria-hidden="true" size={18} /></a>
      </div>
      <p className={styles.status} role="status"><CheckCircle aria-hidden="true" size={18} />{status}</p>
      {error ? <p className={styles.error} role="alert"><Info aria-hidden="true" size={18} />{error}</p> : null}
      {exports.length ? <div className={styles.history}><strong>Immutable export history</strong>{exports.map((record) => <label key={record.id}><input checked={currentExport?.id === record.id} name="export-record" onChange={() => setActiveExportId(record.id)} type="radio" /><span>{record.filename}<small>Version {item.versions.find(({ id }) => id === record.versionId)?.number ?? "?"} · {record.manifest.approvalStatus.replace("_", " ")} · {record.manifestSha256.slice(0, 10)}…</small></span></label>)}</div> : null}
      <form className={styles.receipt} onSubmit={saveReceipt}>
        <div><p className={styles.kicker}>After publishing</p><h3>Record a manual receipt</h3><p>This is user-entered evidence, not platform verification. It stays bound to one export, version, and platform.</p></div>
        <label>Published HTTPS post URL<input aria-label="Published HTTPS post URL" onChange={(event) => setPostUrl(event.target.value)} placeholder="https://…" required type="url" value={postUrl} /></label>
        <label>Published time<input aria-label="Published time" onChange={(event) => setPublishedAt(event.target.value)} required type="datetime-local" value={publishedAt} /></label>
        <button disabled={!currentExport} type="submit">Save manual unverified receipt</button>
      </form>
      {receipts.length ? <p className={styles.receiptCount}>{receipts.length} manual unverified receipt{receipts.length === 1 ? "" : "s"} recorded. <a href="/app/learn">Import results</a></p> : null}
    </section>
  );
}
