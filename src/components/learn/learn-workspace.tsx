"use client";

import { ArrowCounterClockwise, CheckCircle, FileCsv, Info, Trash, TrendUp, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { parseAnalyticsCsv, type AnalyticsColumn, type AnalyticsImportPreview, type AnalyticsMapping, type DuplicatePolicy } from "@/domain/analytics";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./learn.module.css";

const requiredColumns: Array<{ key: AnalyticsColumn; label: string }> = [
  { key: "content_id", label: "Content ID" }, { key: "platform", label: "Platform" }, { key: "post_url", label: "Post URL" }, { key: "published_at", label: "Published time" }, { key: "format", label: "Format" }, { key: "metric_name", label: "Native metric" }, { key: "metric_value", label: "Value" }, { key: "unit", label: "Unit" }, { key: "reporting_window", label: "Reporting window" }, { key: "dimension", label: "Comparison" }, { key: "group", label: "Group" },
];

const starterCsv = `content_id,platform,post_url,published_at,format,metric_name,metric_value,unit,reporting_window,dimension,group
post-1,instagram_reels,https://instagram.com/reel/demo-1,2026-05-01 10:00,reel,views,1220,count,7d,opening_style,question
post-2,instagram_reels,https://instagram.com/reel/demo-2,2026-05-05 10:00,reel,views,1180,count,7d,opening_style,question
post-3,instagram_reels,https://instagram.com/reel/demo-3,2026-05-09 10:00,reel,views,1250,count,7d,opening_style,question
post-4,instagram_reels,https://instagram.com/reel/demo-4,2026-05-13 10:00,reel,views,1210,count,7d,opening_style,question
post-5,instagram_reels,https://instagram.com/reel/demo-5,2026-05-17 10:00,reel,views,1290,count,7d,opening_style,question
post-6,instagram_reels,https://instagram.com/reel/demo-6,2026-05-02 10:00,reel,views,1000,count,7d,opening_style,statement
post-7,instagram_reels,https://instagram.com/reel/demo-7,2026-05-06 10:00,reel,views,1020,count,7d,opening_style,statement
post-8,instagram_reels,https://instagram.com/reel/demo-8,2026-05-10 10:00,reel,views,980,count,7d,opening_style,statement
post-9,instagram_reels,https://instagram.com/reel/demo-9,2026-05-14 10:00,reel,views,1010,count,7d,opening_style,statement
post-10,instagram_reels,https://instagram.com/reel/demo-10,2026-05-18 10:00,reel,views,990,count,7d,opening_style,statement`;

function initialMapping(): AnalyticsMapping {
  return Object.fromEntries(requiredColumns.map(({ key }) => [key, key])) as AnalyticsMapping;
}

export function LearnWorkspace() {
  const metrics = useMuseboardStore((state) => state.metrics);
  const learnings = useMuseboardStore((state) => state.learnings);
  const creator = useMuseboardStore((state) => state.creator);
  const content = useMuseboardStore((state) => state.content);
  const importMetrics = useMuseboardStore((state) => state.importMetrics);
  const deleteMetricImport = useMuseboardStore((state) => state.deleteMetricImport);
  const dismissLearning = useMuseboardStore((state) => state.dismissLearning);
  const restoreLearning = useMuseboardStore((state) => state.restoreLearning);
  const setContentHypothesis = useMuseboardStore((state) => state.setContentHypothesis);
  const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<AnalyticsMapping>(initialMapping);
  const [preview, setPreview] = useState<AnalyticsImportPreview>();
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [timezoneConfirmed, setTimezoneConfirmed] = useState(false);
  const [message, setMessage] = useState("Import platform-native results without flattening views, plays, reach, or impressions into one metric.");
  const timezone = creator?.timezone ?? "America/New_York";
  const importIds = useMemo(() => [...new Set(metrics.map(({ importId }) => importId).filter((id): id is string => Boolean(id)))], [metrics]);
  const sourceHeaders = useMemo(() => csv.split(/\r?\n/u)[0]?.split(",").map((header) => header.trim()).filter(Boolean) ?? [], [csv]);
  const nextContent = content.find(({ stage }) => !["published", "measured", "archived"].includes(stage));

  function applyLearning(learning: (typeof learnings)[number]) {
    if (!nextContent) {
      setMessage("Create or reopen a draft before applying this learning.");
      return;
    }
    const id = setContentHypothesis({ contentId: nextContent.id, learningId: learning.id, statement: learning.statement, expectedOutcome: learning.metricDefinition });
    setMessage(id ? `Saved as a hypothesis for ${nextContent.title}. Measure it after publishing.` : "This learning could not be attached to the next post.");
  }

  function buildPreview() {
    const next = parseAnalyticsCsv(csv, { mapping, existing: metrics, importedAt: new Date().toISOString(), timezone, importId: `metric-import-${Date.now()}` });
    setPreview(next);
    setMessage(`${next.facts.length} valid row${next.facts.length === 1 ? "" : "s"}, ${next.errors.length} error${next.errors.length === 1 ? "" : "s"}, ${next.duplicateKeys.length} duplicate${next.duplicateKeys.length === 1 ? "" : "s"}.`);
  }

  function confirmImport() {
    if (!preview || !timezoneConfirmed) { setMessage(`Confirm that naive timestamps should use ${timezone} before saving.`); return; }
    const ok = importMetrics(preview.facts, preview.duplicateKeys.length ? policy : "skip", new Date().toISOString());
    if (!ok) { setMessage(policy === "cancel" ? "Import cancelled because duplicates were found. Nothing changed." : "The valid rows could not be saved."); return; }
    setMessage(`Saved ${preview.facts.length} valid metric facts. Invalid rows were not imported; learnings were recomputed.`);
    setPreview(undefined); setCsv(""); setTimezoneConfirmed(false);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}><div><p>Evidence, not guesses</p><h1>Learn from your own work.</h1><span>Comparable posts only. Directional associations, never claims of causation.</span></div><div className={styles.metric}><strong>{metrics.length}</strong><span>metric facts</span></div></header>
      <p className={styles.status} role="status"><Info aria-hidden="true" size={19} />{message}</p>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.importer} aria-labelledby="import-heading">
            <div className={styles.sectionHead}><div><p>02 · Bring results back</p><h2 id="import-heading">Preview a CSV before anything changes.</h2></div><FileCsv aria-hidden="true" size={34} /></div>
            <div className={styles.importActions}><label className={styles.fileButton}>Choose CSV<input accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCsv(await file.text()); }} type="file" /></label><button onClick={() => setCsv(starterCsv)} type="button">Load safe sample</button></div>
            <label className={styles.csvField}>CSV contents<textarea aria-label="CSV contents" onChange={(event) => setCsv(event.target.value)} placeholder="Paste CSV rows here…" rows={8} value={csv} /></label>
            {csv ? <div className={styles.mapping}><strong>Column mapping</strong><p>Map each meaning to a source column. Unknown columns remain visible in preview.</p><div>{requiredColumns.map(({ key, label }) => <label key={key}>{label}<select aria-label={`Map ${label}`} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))} value={mapping[key]}><option value={key}>{key}</option>{sourceHeaders.filter((header) => header !== key).map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div></div> : null}
            <button className={styles.primary} disabled={!csv.trim()} onClick={buildPreview} type="button">Preview mapping</button>
            {preview ? <div className={styles.preview}>
              <div className={styles.previewSummary}><span><CheckCircle aria-hidden="true" size={19} />{preview.facts.length} valid</span><span data-warning={Boolean(preview.errors.length)}><Warning aria-hidden="true" size={19} />{preview.errors.length} row errors</span><span data-warning={Boolean(preview.duplicateKeys.length)}>{preview.duplicateKeys.length} duplicates</span></div>
              {preview.unknownFields.length ? <p>Unknown fields kept out of import: {preview.unknownFields.join(", ")}</p> : null}
              {preview.errors.length ? <ul>{preview.errors.slice(0, 6).map((error) => <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>)}</ul> : null}
              {preview.duplicateKeys.length ? <fieldset><legend>Duplicate handling</legend>{(["skip", "replace", "cancel"] as const).map((choice) => <label key={choice}><input checked={policy === choice} name="duplicate-policy" onChange={() => setPolicy(choice)} type="radio" />{choice === "skip" ? "Skip existing facts" : choice === "replace" ? "Replace with corrected values" : "Cancel the entire import"}</label>)}</fieldset> : null}
              <label className={styles.confirm}><input checked={timezoneConfirmed} onChange={(event) => setTimezoneConfirmed(event.target.checked)} type="checkbox" />I confirm naive published times are in {timezone}. Explicit offsets remain unchanged.</label>
              <button className={styles.primary} disabled={!preview.facts.length || !timezoneConfirmed} onClick={confirmImport} type="button">Save valid rows and recompute</button>
            </div> : null}
          </section>

          <section className={styles.learnings} style={{ order: -1 }} aria-labelledby="learning-heading"><div className={styles.sectionHead}><div><p>01 · Choose what to test next</p><h2 id="learning-heading">Your current learnings</h2></div><TrendUp aria-hidden="true" size={34} /></div>
            {!learnings.length ? <div className={styles.empty}><h3>No defensible pattern yet.</h3><p>Use at least three comparable posts in each group. Five per group plus a 10% effect can reach medium confidence.</p><button onClick={() => setCsv(starterCsv)} type="button">Load a 10-post sample</button></div> : learnings.map((learning) => <article className={styles.learning} data-dismissed={Boolean(learning.dismissedAt)} key={learning.id}>
              <div><span className={styles.confidence}>{learning.confidence} confidence</span><h3>{learning.statement}</h3><p>{learning.metricDefinition}</p></div>
              <dl><div><dt>Sample</dt><dd>{learning.sampleSize} posts</dd></div><div><dt>Comparison</dt><dd>{learning.comparison ?? "Comparable posts"}</dd></div><div><dt>Rule</dt><dd>{learning.confidenceRule ?? "Descriptive aggregate"}</dd></div></dl>
              <details><summary>Inspect included and excluded posts</summary><p><strong>Included:</strong> {learning.includedContentIds.join(", ")}</p><p><strong>Excluded:</strong> {learning.excludedContentIds?.join(", ") || "None"}</p><p>Last recomputed: {learning.lastRecomputedAt ? new Date(learning.lastRecomputedAt).toLocaleString() : "Legacy sample"}</p></details>
              <button disabled={Boolean(learning.dismissedAt)} onClick={() => applyLearning(learning)} type="button"><CheckCircle aria-hidden="true" size={18} />Use in next post</button><button onClick={() => learning.dismissedAt ? restoreLearning(learning.id) : dismissLearning(learning.id)} type="button">{learning.dismissedAt ? <><ArrowCounterClockwise aria-hidden="true" size={18} />Restore learning</> : "Dismiss from recommendations"}</button>
            </article>)}
          </section>
        </div>
        <aside className={styles.aside}><p>Metric discipline</p><h2>Native names stay native.</h2><ul><li>Views, plays, reach, and impressions remain separate facts.</li><li>Comparisons never cross platform, format, metric, unit, or reporting window.</li><li>Deleting an import removes its facts and recomputes the pattern.</li></ul>{importIds.length ? <div className={styles.imports}><strong>Saved imports</strong>{importIds.map((id) => <button key={id} onClick={() => deleteMetricImport(id)} type="button"><span>{id}</span><Trash aria-label={`Delete ${id}`} size={17} /></button>)}</div> : <p className={styles.noImports}>No CSV imports saved in this browser.</p>}</aside>
      </div>
    </div>
  );
}
