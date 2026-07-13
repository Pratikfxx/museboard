"use client";

import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  Info,
  LinkSimple,
  MagicWand,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { hasRequiredEvidence, type WorkshopVersionPatch } from "@/domain/workflow";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./workshop.module.css";

const stages = ["evidence", "angle", "hook", "outline", "script", "shoot", "review", "ready"] as const;
type WorkshopStage = (typeof stages)[number];

const stageLabels: Record<WorkshopStage, string> = {
  evidence: "Evidence",
  angle: "Angle",
  hook: "Hooks",
  outline: "Outline",
  script: "Script",
  shoot: "Shoot",
  review: "Review",
  ready: "Ready",
};

function validStage(stage?: string): WorkshopStage | undefined {
  return stages.find((candidate) => candidate === stage);
}

function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

interface WorkshopWorkspaceProps {
  contentId: string;
  initialStage?: "hook" | "outline" | "script";
  voiceMode?: boolean;
}

export function WorkshopWorkspace(props: WorkshopWorkspaceProps) {
  const available = useMuseboardStore((state) => state.content.some(({ id }) => id === props.contentId));
  if (!available) {
    return <section className={styles.empty}><h1>No draft selected.</h1><Link href="/app/opportunities">Choose an opportunity</Link></section>;
  }
  return <WorkshopEditor {...props} />;
}

function WorkshopEditor({
  contentId,
  initialStage,
  voiceMode = false,
}: WorkshopWorkspaceProps) {
  const content = useMuseboardStore((state) => state.content);
  const hooks = useMuseboardStore((state) => state.hooks);
  const creator = useMuseboardStore((state) => state.creator);
  const opportunities = useMuseboardStore((state) => state.opportunities);
  const saveWorkshopVersion = useMuseboardStore((state) => state.saveWorkshopVersion);
  const item = content.find(({ id }) => id === contentId);
  const currentVersion = item?.versions.find(({ id }) => id === item.currentVersionId) ?? item?.versions.at(-1);
  const itemHooks = hooks.filter((hook) => hook.contentId === item?.id);
  const opportunity = opportunities.find(({ id }) => id === item?.opportunityId);
  const startingStage = voiceMode ? "script" : validStage(initialStage) ?? validStage(item?.stage) ?? "hook";
  const [stage, setStage] = useState<WorkshopStage>(startingStage);
  const [selectedHookId, setSelectedHookId] = useState(currentVersion?.selectedHookId ?? itemHooks[0]?.id ?? "");
  const [manualHook, setManualHook] = useState(currentVersion?.selectedHookText ?? itemHooks.find(({ id }) => id === (currentVersion?.selectedHookId ?? itemHooks[0]?.id))?.text ?? "");
  const [angle, setAngle] = useState(currentVersion?.angle ?? "");
  const [outline, setOutline] = useState((currentVersion?.outline ?? ["Name the tension", "Show the useful reset", "Invite one small action"]).join("\n"));
  const [script, setScript] = useState(currentVersion?.script ?? "");
  const [shotList, setShotList] = useState((currentVersion?.shotList ?? ["Opening detail", "Process close-up", "Creator to camera"]).join("\n"));
  const [assets, setAssets] = useState((currentVersion?.assets ?? ["Creator-owned footage", "Rights-cleared audio"]).join("\n"));
  const [saveStatus, setSaveStatus] = useState("Saved to this browser · no server sync");
  const [error, setError] = useState("");
  const [editRevision, setEditRevision] = useState(0);
  const lastSavedRevision = useRef(0);
  const pendingPatch = useRef<WorkshopVersionPatch | undefined>(undefined);
  const latestId = item?.currentVersionId;

  const flushPendingDraft = useCallback(() => {
    if (editRevision === 0 || editRevision === lastSavedRevision.current) return;
    const liveItem = useMuseboardStore.getState().content.find(({ id }) => id === contentId);
    const patch = pendingPatch.current;
    if (!liveItem || !patch) return;
    lastSavedRevision.current = editRevision;
    saveWorkshopVersion({ contentId: liveItem.id, patch });
    setSaveStatus("Saved · version added to this browser");
  }, [contentId, editRevision, saveWorkshopVersion]);

  useEffect(() => {
    const timer = window.setTimeout(flushPendingDraft, 500);
    return () => window.clearTimeout(timer);
  }, [flushPendingDraft]);

  const evidence = currentVersion?.evidence ?? (opportunity?.evidence ?? []).map((entry, index) => ({
    id: `opportunity-evidence-${index + 1}`,
    label: entry.sourceLabel,
    summary: entry.summary,
    attached: true,
  }));

  if (!item || !currentVersion) {
    return <section className={styles.empty}><h1>No draft selected.</h1><Link href="/app/opportunities">Choose an opportunity</Link></section>;
  }
  const activeItem = item;
  const activeVersion = currentVersion;

  function changeEditor(value: string, setter: (next: string) => void, patch: WorkshopVersionPatch) {
    setter(value);
    pendingPatch.current = patch;
    setEditRevision((revision) => revision + 1);
    setSaveStatus("Saving…");
  }

  function chooseHook() {
    const hook = itemHooks.find(({ id }) => id === selectedHookId);
    if (!hook) return;
    saveWorkshopVersion({
      contentId: activeItem.id,
      patch: { selectedHookId: hook.id, selectedHookText: manualHook.trim() || hook.text },
      nextStage: "outline",
    });
    setStage("outline");
    setSaveStatus("Saved · version added to this browser");
  }

  function goToStage(next: WorkshopStage) {
    flushPendingDraft();
    setError("");
    if (next === "ready") {
      const draft = {
        ...activeVersion,
        outline: lines(outline),
        script,
        shotList: lines(shotList),
        assets: lines(assets),
      };
      if (!hasRequiredEvidence(draft)) {
        setError("Attach evidence for source-required claims before marking this ready.");
        return;
      }
      saveWorkshopVersion({ contentId: activeItem.id, patch: draft, nextStage: "ready" });
    }
    setStage(next);
  }

  const heading = {
    evidence: "Ground the idea",
    angle: "Choose the promise",
    hook: "Find the opening",
    outline: "Shape the outline",
    script: voiceMode ? "Rewrite in your voice" : "Write the script",
    shoot: "Plan the shoot",
    review: "Review the whole story",
    ready: "Ready to hand off",
  }[stage];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p>Sample workspace · not live</p><h1>{heading}</h1><span>{item.title}</span></div>
        <div className={styles.saveState}><CheckCircle aria-hidden="true" size={18} /><span>{saveStatus}</span></div>
      </header>

      <nav aria-label="Workshop stages" className={styles.stageNav}>
        {stages.map((candidate) => (
          <button aria-current={candidate === stage ? "step" : undefined} aria-label={stageLabels[candidate]} data-active={candidate === stage} key={candidate} onClick={() => goToStage(candidate)} type="button">
            <span>{stages.indexOf(candidate) + 1}</span>{stageLabels[candidate]}
          </button>
        ))}
      </nav>

      {error ? <div className={styles.alert} role="alert"><Info aria-hidden="true" size={20} /><span>{error}</span><button onClick={() => setStage("script")} type="button">Continue manually</button></div> : null}

      <div className={styles.layout}>
        <main className={styles.editor}>
          {voiceMode && stage === "script" ? (
            <section className={styles.voiceNote}>
              <MagicWand aria-hidden="true" size={22} />
              <div><strong>This uses only the voice traits you confirmed.</strong><p>{creator?.voiceTraits.join(", ") ?? "Warm, candid, precise"}. Your boundaries stay active, and you can always continue by hand.</p></div>
            </section>
          ) : null}

          {stage === "evidence" ? (
            <section><p className={styles.kicker}>Source desk</p><h2>Know what supports the idea.</h2><div className={styles.evidenceList}>{evidence.length ? evidence.map((source) => <article key={source.id}><LinkSimple aria-hidden="true" size={20} /><div><strong>{source.label}</strong><p>{source.summary}</p><small>{source.attached ? "Attached to this draft" : "Reference only"}</small></div></article>) : <p>No evidence attached yet. Keep claims personal and observable.</p>}</div></section>
          ) : null}

          {stage === "angle" ? (
            <section><p className={styles.kicker}>Editorial promise</p><h2>What changes for the viewer?</h2><label className={styles.field}>Angle<textarea aria-label="Angle" onChange={(event) => changeEditor(event.target.value, setAngle, { angle: event.target.value })} rows={5} value={angle} /></label></section>
          ) : null}

          {stage === "hook" ? (
            <section><p className={styles.kicker}>Three credible openings</p><h2>Pick the one that sounds like you.</h2><fieldset className={styles.hookList}><legend className={styles.srOnly}>Hook choices</legend>{itemHooks.map((hook) => <label key={hook.id} data-selected={selectedHookId === hook.id}><input checked={selectedHookId === hook.id} name="workshop-hook" onChange={() => { setSelectedHookId(hook.id); setManualHook(hook.text); }} type="radio" /><span><strong>{hook.id.includes("1") ? "Plain-spoken" : hook.id.includes("2") ? "Specific" : "Invitation"}</strong><em>{hook.text}</em><small>{hook.rationale}</small></span></label>)}</fieldset><label className={styles.field}>Manual hook edit<textarea aria-label="Manual hook edit" onChange={(event) => { setManualHook(event.target.value); setSaveStatus("Unsaved hook edit · choose Use this hook to create a version"); }} rows={3} value={manualHook} /></label><button className={styles.primaryButton} onClick={chooseHook} type="button">Use this hook <ArrowRight aria-hidden="true" size={18} /></button></section>
          ) : null}

          {stage === "outline" ? (
            <section><p className={styles.kicker}>Three-beat structure</p><h2>Make the progression easy to follow.</h2><label className={styles.field}>Outline beats<textarea aria-label="Outline beats" onChange={(event) => changeEditor(event.target.value, setOutline, { outline: lines(event.target.value) })} rows={10} value={outline} /></label></section>
          ) : null}

          {stage === "script" ? (
            <section><p className={styles.kicker}>Creator-owned draft</p><h2>Keep the language speakable.</h2><label className={styles.field}>Script draft<textarea aria-label="Script draft" onChange={(event) => changeEditor(event.target.value, setScript, { script: event.target.value })} rows={16} value={script} /></label><p className={styles.manualNote}>Manual editing stays unlimited. Suggestions never replace your draft without a version.</p></section>
          ) : null}

          {stage === "shoot" ? (
            <section><p className={styles.kicker}>Production checklist</p><h2>Turn words into a shootable plan.</h2><div className={styles.twoFields}><label className={styles.field}>Shot list<textarea aria-label="Shot list" onChange={(event) => changeEditor(event.target.value, setShotList, { shotList: lines(event.target.value), assets: lines(assets) })} rows={10} value={shotList} /></label><label className={styles.field}>Assets<textarea aria-label="Assets" onChange={(event) => changeEditor(event.target.value, setAssets, { shotList: lines(shotList), assets: lines(event.target.value) })} rows={10} value={assets} /></label></div></section>
          ) : null}

          {stage === "review" ? <section><p className={styles.kicker}>Final read-through</p><h2>Does the promise survive the cut?</h2><div className={styles.review}><strong>{currentVersion.selectedHookText ?? itemHooks.find(({ id }) => id === selectedHookId)?.text}</strong><ol>{lines(outline).map((beat) => <li key={beat}>{beat}</li>)}</ol><p>{script}</p></div><button className={styles.primaryButton} onClick={() => goToStage("ready")} type="button">Ready for handoff <ArrowRight aria-hidden="true" size={18} /></button></section> : null}
          {stage === "ready" ? <section className={styles.ready}><CheckCircle aria-hidden="true" size={44} weight="fill" /><p className={styles.kicker}>Draft locked</p><h2>Ready to schedule and share.</h2><p>Your sources, creator edits, and latest version stay attached.</p><Link href="/app/plan">Open the weekly planner <ArrowRight aria-hidden="true" size={18} /></Link></section> : null}
        </main>

        <aside aria-label="Craft guidance" className={styles.guidance}>
          <p className={styles.kicker}>Craft guidance</p>
          <h2>Make one promise at a time.</h2>
          <p>For {creator?.audience ?? "your audience"}, specificity earns more trust than urgency.</p>
          <ul><li>Read every line aloud.</li><li>Show the proof before the advice.</li><li>Keep one clean exit for the viewer.</li></ul>
          <details><summary><Info aria-hidden="true" size={17} /> How this was made</summary><p>Deterministic sample guidance based on your confirmed audience, pillar, platform, and voice. No live AI request was made.</p></details>
          <div className={styles.versionBox}><ClockCounterClockwise aria-hidden="true" size={20} /><span><strong>Version {item.versions.length}</strong><small>{item.versions.length} immutable draft{item.versions.length === 1 ? "" : "s"} saved</small></span></div>
          <small className={styles.versionId}>Current: {latestId}</small>
        </aside>
      </div>
    </div>
  );
}
