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

import { activeActor } from "@/domain/collaboration";
import { hasRequiredEvidence, type WorkshopVersionPatch } from "@/domain/workflow";
import {
  createVoiceRewrite,
  type VoiceRewriteResult,
} from "@/lib/providers/voice-rewrite";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import { ExportPanel } from "./export-panel";
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

function workshopStage(stage?: string): WorkshopStage | undefined {
  if (stage === "signal") return "evidence";
  return validStage(stage);
}

function domainStage(stage: WorkshopStage) {
  return stage === "evidence" ? "signal" : stage;
}

function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

interface WorkshopWorkspaceProps {
  contentId: string;
  initialStage?: "hook" | "outline" | "script" | "review";
  voiceMode?: boolean;
  focusTarget?: string;
  focusKind?: "comment" | "approval" | "assignment";
  requestedVersionId?: string;
  notificationId?: string;
}

export function WorkshopWorkspace(props: WorkshopWorkspaceProps) {
  const available = useMuseboardStore((state) => state.content.some(({ id }) => id === props.contentId));
  if (props.contentId === "new") return <CreateLauncher />;
  if (!available) {
    return <section className={styles.empty}><h1>No draft selected.</h1><Link href="/app/opportunities">Choose an opportunity</Link></section>;
  }
  return <WorkshopEditor {...props} />;
}

function CreateLauncher() {
  const content = useMuseboardStore((state) => state.content);
  const ideas = useMuseboardStore((state) => state.ideas);
  const recentDrafts = [...content]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  return (
    <section className={styles.launcher}>
      <header>
        <p className={styles.kicker}>Create workspace</p>
        <h1>Move an idea into the work.</h1>
        <span>
          Shape a source-backed opportunity first, then build its angle, hooks, script, and shoot plan without losing the evidence behind it.
        </span>
        <div className={styles.launcherActions}>
          <Link className={styles.launcherPrimary} href="/app/opportunities/ideas">
            {ideas.length ? `Open Idea Board · ${ideas.length} shaped` : "Open Idea Board"}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <Link href="/app/opportunities">Find an opportunity</Link>
        </div>
      </header>

      {recentDrafts.length ? (
        <div className={styles.recentDrafts}>
          <div><p className={styles.kicker}>Continue working</p><span>Your latest sample drafts</span></div>
          {recentDrafts.map((draft) => {
            const stage = draft.stage === "signal" ? "evidence" : draft.stage;
            return (
              <Link href={`/app/create/${draft.id}?stage=${stage}`} key={draft.id}>
                <span><strong>{draft.title}</strong><small>{stage} · {draft.platform.replaceAll("_", " ")}</small></span>
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.launcherNote}>
          <Info aria-hidden="true" size={20} />
          <span><strong>No draft yet.</strong> Shape an opportunity and promote it from the Idea Board to begin.</span>
        </div>
      )}
    </section>
  );
}

function WorkshopEditor({
  contentId,
  initialStage,
  voiceMode = false,
  focusTarget,
  focusKind,
  requestedVersionId,
  notificationId,
}: WorkshopWorkspaceProps) {
  const content = useMuseboardStore((state) => state.content);
  const hooks = useMuseboardStore((state) => state.hooks);
  const creator = useMuseboardStore((state) => state.creator);
  const creatorMemory = useMuseboardStore((state) => state.creatorMemory);
  const dataMode = useMuseboardStore((state) => state.dataMode);
  const plan = useMuseboardStore((state) => state.entitlementUsage.plan);
  const opportunities = useMuseboardStore((state) => state.opportunities);
  const saveWorkshopVersion = useMuseboardStore((state) => state.saveWorkshopVersion);
  const moveTask = useMuseboardStore((state) => state.moveTask);
  const reviewComments = useMuseboardStore((state) => state.reviewComments);
  const approvals = useMuseboardStore((state) => state.approvals);
  const assignments = useMuseboardStore((state) => state.assignments);
  const memberships = useMuseboardStore((state) => state.memberships);
  const currentActorMembershipId = useMuseboardStore((state) => state.currentActorMembershipId);
  const notifications = useMuseboardStore((state) => state.notifications);
  const openNotification = useMuseboardStore((state) => state.openNotification);
  const item = content.find(({ id }) => id === contentId);
  const currentVersion = item?.versions.find(({ id }) => id === item.currentVersionId) ?? item?.versions.at(-1);
  const itemHooks = hooks.filter((hook) => hook.contentId === item?.id);
  const opportunity = opportunities.find(({ id }) => id === item?.opportunityId);
  const startingStage = voiceMode ? "script" : validStage(initialStage) ?? workshopStage(item?.stage) ?? "hook";
  const [stage, setStage] = useState<WorkshopStage>(startingStage);
  const [selectedHookId, setSelectedHookId] = useState(currentVersion?.selectedHookId ?? itemHooks[0]?.id ?? "");
  const [manualHook, setManualHook] = useState(currentVersion?.selectedHookText ?? itemHooks.find(({ id }) => id === (currentVersion?.selectedHookId ?? itemHooks[0]?.id))?.text ?? "");
  const [angle, setAngle] = useState(currentVersion?.angle ?? "");
  const [outline, setOutline] = useState((currentVersion?.outline ?? ["Name the tension", "Show the useful reset", "Invite one small action"]).join("\n"));
  const [script, setScript] = useState(currentVersion?.script ?? "");
  const [shotList, setShotList] = useState((currentVersion?.shotList ?? ["Opening detail", "Process close-up", "Creator to camera"]).join("\n"));
  const [assets, setAssets] = useState((currentVersion?.assets ?? ["Creator-owned footage", "Rights-cleared audio"]).join("\n"));
  const [saveStatus, setSaveStatus] = useState(
    dataMode === "live" ? "Draft saved · workspace synced" : "Saved on this device",
  );
  const [error, setError] = useState("");
  const [rewriteResult, setRewriteResult] = useState<VoiceRewriteResult>();
  const [rewriteStatus, setRewriteStatus] = useState<"idle" | "preview" | "saved">("idle");
  const rewriteSourceRef = useRef<{ versionId: string; memoryVersion: number } | undefined>(undefined);
  const rewriteHeadingRef = useRef<HTMLHeadingElement>(null);
  const [editRevision, setEditRevision] = useState(0);
  const editRevisionRef = useRef(0);
  const lastSavedRevision = useRef(0);
  const pendingPatch = useRef<WorkshopVersionPatch | undefined>(undefined);
  const contextTargetRef = useRef<HTMLDivElement>(null);
  const latestId = item?.currentVersionId;
  const linkedNotification = notificationId ? notifications.find(({ id }) => id === notificationId) : undefined;
  const actor = activeActor(memberships, currentActorMembershipId);
  const notificationMatchesTarget = Boolean(
    focusKind && focusTarget && linkedNotification?.href.startsWith(`/app/create/${contentId}?`) &&
    linkedNotification.href.includes(`${focusKind}=${encodeURIComponent(focusTarget)}`) &&
    (!requestedVersionId || linkedNotification.href.includes(`version=${encodeURIComponent(requestedVersionId)}`)),
  );
  const targetAuthorized = !notificationId || Boolean(
    linkedNotification && linkedNotification.recipientMembershipId === actor?.id &&
    linkedNotification.href.includes(`notification=${encodeURIComponent(notificationId)}`) &&
    notificationMatchesTarget
  );
  const requestedVersion = requestedVersionId && targetAuthorized
    ? item?.versions.find(({ id }) => id === requestedVersionId)
    : undefined;
  const displayedReviewVersion = stage === "review" && requestedVersion ? requestedVersion : currentVersion;
  const commentTarget = targetAuthorized && focusKind === "comment" ? reviewComments.find(({ id, contentId: targetContentId, versionId }) => id === focusTarget && targetContentId === contentId && versionId === requestedVersionId) : undefined;
  const approvalTarget = targetAuthorized && focusKind === "approval" ? approvals.find(({ id, contentId: targetContentId, versionId }) => id === focusTarget && targetContentId === contentId && versionId === requestedVersionId) : undefined;
  const assignmentTarget = targetAuthorized && focusKind === "assignment" ? assignments.find(({ id, contentId: targetContentId, versionId }) => id === focusTarget && targetContentId === contentId && versionId === requestedVersionId) : undefined;
  const targetResolved = Boolean(commentTarget || approvalTarget || assignmentTarget);
  const targetCopy = (() => {
    if (!focusTarget) return undefined;
    if (!targetAuthorized) return "This team link belongs to another active collaborator.";
    if (focusKind === "comment") {
      return commentTarget ? `${commentTarget.authorDisplayNameSnapshot}: “${commentTarget.body}”` : "The linked comment is no longer available.";
    }
    if (focusKind === "approval") {
      return approvalTarget ? `Approval ${approvalTarget.status.replace("_", " ")} by ${approvalTarget.actorDisplayNameSnapshot}.` : "The linked approval is no longer available.";
    }
    if (focusKind === "assignment") {
      const assignee = memberships.find(({ id }) => id === assignmentTarget?.assigneeMembershipId)?.displayNameSnapshot;
      const reviewer = memberships.find(({ id }) => id === assignmentTarget?.reviewerMembershipId)?.displayNameSnapshot;
      return assignmentTarget ? `${assignee ?? "Unassigned"} is shaping ${assignmentTarget.stage}; ${reviewer ?? "no reviewer"} is reviewing.` : "The linked assignment is no longer available.";
    }
    return "Opened from the team workspace.";
  })();

  useEffect(() => {
    if (targetResolved) contextTargetRef.current?.focus();
  }, [targetResolved]);

  useEffect(() => {
    if (!notificationId || !targetResolved) return;
    const notification = notifications.find(({ id }) => id === notificationId);
    if (!notification || !notification.href.includes(`notification=${encodeURIComponent(notificationId)}`)) return;
    openNotification(notificationId, `${window.location.pathname}${window.location.search}`);
  }, [notificationId, notifications, openNotification, targetResolved]);

  const flushPendingDraft = useCallback((updateStatus = true) => {
    const revision = editRevisionRef.current;
    if (revision === 0 || revision === lastSavedRevision.current) return;
    const liveItem = useMuseboardStore.getState().content.find(({ id }) => id === contentId);
    const patch = pendingPatch.current;
    if (!liveItem || !patch) return;
    lastSavedRevision.current = revision;
    useMuseboardStore.getState().saveWorkshopVersion({ contentId: liveItem.id, patch });
    pendingPatch.current = undefined;
    if (updateStatus) {
      setSaveStatus(dataMode === "live" ? "Draft version saved · syncing workspace" : "Saved on this device");
    }
  }, [contentId, dataMode]);

  useEffect(() => {
    const timer = window.setTimeout(flushPendingDraft, 500);
    return () => window.clearTimeout(timer);
  }, [editRevision, flushPendingDraft]);

  useEffect(() => {
    const handlePageHide = () => flushPendingDraft(false);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushPendingDraft(false);
    };
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

  function changeEditor(value: string, setter: (next: string) => void, patch: WorkshopVersionPatch) {
    setter(value);
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    editRevisionRef.current += 1;
    setEditRevision(editRevisionRef.current);
    setSaveStatus("Saving…");
  }

  function chooseHook() {
    const hook = itemHooks.find(({ id }) => id === selectedHookId);
    if (!hook) return;
    lastSavedRevision.current = editRevisionRef.current;
    pendingPatch.current = undefined;
    saveWorkshopVersion({
      contentId: activeItem.id,
      patch: { selectedHookId: hook.id, selectedHookText: manualHook.trim() || hook.text },
      nextStage: "outline",
    });
    setStage("outline");
    setSaveStatus(dataMode === "live" ? "Draft version saved · syncing workspace" : "Saved on this device");
  }

  function generateVoiceRewrite() {
    const sourceVersionId = currentVersion?.id;
    if (!creator || !sourceVersionId || !script.trim()) return;
    setError("");
    const result = createVoiceRewrite({
      contentId: activeItem.id,
      versionId: sourceVersionId,
      script,
      voiceTraits: creator.voiceTraits,
      boundaries: creator.boundaries,
      memory: creatorMemory,
      target: {
        platform: activeItem.platform,
        format: opportunity?.format ?? "short-form video",
      },
    });
    rewriteSourceRef.current = {
      versionId: sourceVersionId,
      memoryVersion: creatorMemory.version,
    };
    setRewriteResult(result);
    setRewriteStatus("preview");
    window.requestAnimationFrame(() => rewriteHeadingRef.current?.focus());
  }

  function applyVoiceRewrite() {
    if (!rewriteResult || rewriteStatus !== "preview") return;
    const live = useMuseboardStore.getState();
    const liveItem = live.content.find(({ id }) => id === contentId);
    const source = rewriteSourceRef.current;
    if (
      !liveItem ||
      !source ||
      liveItem.currentVersionId !== source.versionId ||
      live.creatorMemory.version !== source.memoryVersion
    ) {
      setError("The draft or Creator Memory changed after this preview. Generate a fresh rewrite before saving.");
      return;
    }
    pendingPatch.current = undefined;
    lastSavedRevision.current = editRevisionRef.current;
    const saved = saveWorkshopVersion({
      contentId,
      patch: {
        script: rewriteResult.rewrittenScript,
        generationProvenance: rewriteResult.provenance,
      },
      nextStage: "script",
    });
    if (!saved) {
      setError("Museboard could not save this rewrite. Your original draft is unchanged.");
      return;
    }
    setScript(rewriteResult.rewrittenScript);
    setRewriteStatus("saved");
    setSaveStatus(
      dataMode === "live"
        ? `Rewrite saved as version ${liveItem.versions.length + 1} · syncing workspace`
        : `Rewrite saved as version ${liveItem.versions.length + 1}`,
    );
  }

  function goToStage(next: WorkshopStage) {
    setError("");
    if (next === "ready") {
      const state = useMuseboardStore.getState();
      const liveItem = state.content.find(({ id }) => id === contentId);
      const liveVersion = liveItem?.versions.find(({ id }) => id === liveItem.currentVersionId) ?? liveItem?.versions.at(-1);
      if (!liveItem || !liveVersion) return;
      const draft = {
        ...liveVersion,
        ...pendingPatch.current,
        angle,
        selectedHookId,
        selectedHookText: manualHook,
        outline: lines(outline),
        script,
        shotList: lines(shotList),
        assets: lines(assets),
      };
      if (!hasRequiredEvidence(draft)) {
        setError("Attach evidence for source-required claims before marking this ready.");
        return;
      }
      const dirty = editRevisionRef.current !== lastSavedRevision.current || Boolean(pendingPatch.current);
      const approvalRequired = plan === "pro" || plan === "studio";
      if (approvalRequired && dirty) {
        lastSavedRevision.current = editRevisionRef.current;
        pendingPatch.current = undefined;
        saveWorkshopVersion({ contentId: liveItem.id, patch: draft, nextStage: "review" });
        setStage("review");
        setError("Your edits are saved as a new version. Request a fresh review before exporting.");
        setSaveStatus("Saved · new version needs review");
        return;
      }
      const approvedCurrent = liveItem.approval?.versionId === liveItem.currentVersionId && liveItem.approval.status === "approved";
      if (approvalRequired && !approvedCurrent) {
        setStage("review");
        setError("This current version needs approval before it can be exported.");
        return;
      }
      lastSavedRevision.current = editRevisionRef.current;
      pendingPatch.current = undefined;
      if (dirty) saveWorkshopVersion({ contentId: liveItem.id, patch: draft, nextStage: "ready" });
      else moveTask(liveItem.id, "ready");
      setSaveStatus(dirty ? "Saved · ready version added to this browser" : "Approved version · ready for handoff");
    } else {
      flushPendingDraft();
      moveTask(activeItem.id, domainStage(next));
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
        <div><p>{dataMode === "live" ? "Cloud workspace" : "Sample workspace · not live"}</p><h1>{heading}</h1><span>{item.title}</span></div>
        <div className={styles.saveState}><CheckCircle aria-hidden="true" size={18} /><span>{saveStatus}</span></div>
      </header>

      {targetCopy ? (
        <div aria-live="polite" className={styles.contextBanner} ref={contextTargetRef} role="status" tabIndex={-1}>
          <Info aria-hidden="true" size={19} />
          <span><strong>Team context</strong> · {targetCopy}</span>
        </div>
      ) : null}

      <nav aria-label="Workshop stages" className={styles.stageNav}>
        {stages.map((candidate) => (
          <button aria-current={candidate === stage ? "step" : undefined} aria-label={stageLabels[candidate]} data-active={candidate === stage} key={candidate} onClick={() => goToStage(candidate)} type="button">
            <span>{stages.indexOf(candidate) + 1}</span>{stageLabels[candidate]}
          </button>
        ))}
      </nav>

      {error ? <div className={styles.alert} role="alert"><Info aria-hidden="true" size={20} /><span>{error}</span><button onClick={() => goToStage("script")} type="button">Continue manually</button></div> : null}

      <div className={styles.layout}>
        <main className={styles.editor}>
          {voiceMode && stage === "script" ? (
            <section className={styles.voiceNote}>
              <MagicWand aria-hidden="true" size={22} />
              <div>
                <strong>Creator Memory v{creatorMemory.version} guides this local voice pass.</strong>
                <p>{creator?.voiceTraits.join(", ") ?? "Warm, candid, precise"}. Preferred phrases, avoided language, structures, notes, and boundaries stay visible for review.</p>
                <Link href="/app/settings/memory">Review voice memory</Link>
              </div>
            </section>
          ) : null}

          {stage === "evidence" ? (
            <section><p className={styles.kicker}>Source desk</p><h2>Know what supports the idea.</h2><div className={styles.evidenceList}>{evidence.length ? evidence.map((source) => <article key={source.id}><LinkSimple aria-hidden="true" size={20} /><div><strong>{source.label}</strong><p>{source.summary}</p><small>{source.attached ? "Attached to this draft" : "Reference only"}</small></div></article>) : <p>No evidence attached yet. Keep claims personal and observable.</p>}</div></section>
          ) : null}

          {stage === "angle" ? (
            <section><p className={styles.kicker}>Editorial promise</p><h2>What changes for the viewer?</h2><label className={styles.field}>Angle<textarea aria-label="Angle" onChange={(event) => changeEditor(event.target.value, setAngle, { angle: event.target.value })} rows={5} value={angle} /></label></section>
          ) : null}

          {stage === "hook" ? (
            <section><p className={styles.kicker}>Three credible openings</p><h2>Pick the one that sounds like you.</h2><fieldset className={styles.hookList}><legend className={styles.srOnly}>Hook choices</legend>{itemHooks.map((hook, index) => <label key={hook.id} data-selected={selectedHookId === hook.id}><input checked={selectedHookId === hook.id} name="workshop-hook" onChange={() => { setSelectedHookId(hook.id); setManualHook(hook.text); }} type="radio" /><span><strong>{["Plain-spoken", "Specific", "Invitation"][index] ?? "Alternative"}</strong><em>{hook.text}</em><small>{hook.rationale}</small></span></label>)}</fieldset><label className={styles.field}>Manual hook edit<textarea aria-label="Manual hook edit" onChange={(event) => changeEditor(event.target.value, setManualHook, { selectedHookId, selectedHookText: event.target.value })} rows={3} value={manualHook} /></label><button className={styles.primaryButton} onClick={chooseHook} type="button">Use this hook <ArrowRight aria-hidden="true" size={18} /></button></section>
          ) : null}

          {stage === "outline" ? (
            <section><p className={styles.kicker}>Three-beat structure</p><h2>Make the progression easy to follow.</h2><label className={styles.field}>Outline beats<textarea aria-label="Outline beats" onChange={(event) => changeEditor(event.target.value, setOutline, { outline: lines(event.target.value) })} rows={10} value={outline} /></label></section>
          ) : null}

          {stage === "script" ? (
            <section>
              <p className={styles.kicker}>Creator-owned draft</p><h2>Keep the language speakable.</h2>
              <label className={styles.field}>Script draft<textarea aria-label="Script draft" onChange={(event) => { setRewriteResult(undefined); setRewriteStatus("idle"); changeEditor(event.target.value, setScript, { script: event.target.value }); }} rows={voiceMode ? 9 : 16} value={script} /></label>
              <p className={styles.manualNote}>Manual editing stays unlimited. Suggestions never replace your draft without a version.</p>
              {voiceMode ? (
                <div aria-busy="false" className={styles.rewriteWorkbench}>
                  <div className={styles.rewriteActions}>
                    <button className={styles.primaryButton} disabled={!script.trim()} onClick={generateVoiceRewrite} type="button">
                      {rewriteStatus === "preview" ? "Generate another rewrite" : "Generate voice rewrite"}
                    </button>
                    {rewriteStatus === "preview" ? <button onClick={() => { setRewriteResult(undefined); setRewriteStatus("idle"); }} type="button">Keep original</button> : null}
                  </div>
                  {rewriteResult ? (
                    <section aria-label="Voice rewrite comparison" className={styles.rewritePreview}>
                      <h2 ref={rewriteHeadingRef} tabIndex={-1}>Suggested rewrite</h2>
                      <p>This preview is not saved yet. Compare it with your source before creating a new version.</p>
                      <div className={styles.rewriteComparison}>
                        <label className={styles.field}>Original script<textarea aria-label="Original script" readOnly rows={9} value={rewriteResult.originalScript} /></label>
                        <label className={styles.field}>Suggested script<textarea aria-label="Suggested script" readOnly rows={9} value={rewriteResult.rewrittenScript} /></label>
                      </div>
                      {rewriteResult.warnings.map((warning) => <p className={styles.rewriteWarning} key={warning}>{warning}</p>)}
                      <ul>{rewriteResult.changes.map((change) => <li key={change}>{change}</li>)}</ul>
                      <div className={styles.rewriteActions}>
                        <button className={styles.primaryButton} disabled={rewriteStatus !== "preview"} onClick={applyVoiceRewrite} type="button">Use this rewrite</button>
                        <button onClick={() => { setRewriteResult(undefined); setRewriteStatus("idle"); }} type="button">Keep original</button>
                      </div>
                      <details>
                        <summary>How this rewrite was made</summary>
                        <p>Deterministic local voice pass · no live AI request. Creator Memory v{rewriteResult.appliedMemory.version}; {rewriteResult.provenance.model}.</p>
                      </details>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {stage === "shoot" ? (
            <section><p className={styles.kicker}>Production checklist</p><h2>Turn words into a shootable plan.</h2><div className={styles.twoFields}><label className={styles.field}>Shot list<textarea aria-label="Shot list" onChange={(event) => changeEditor(event.target.value, setShotList, { shotList: lines(event.target.value), assets: lines(assets) })} rows={10} value={shotList} /></label><label className={styles.field}>Assets<textarea aria-label="Assets" onChange={(event) => changeEditor(event.target.value, setAssets, { shotList: lines(shotList), assets: lines(event.target.value) })} rows={10} value={assets} /></label></div></section>
          ) : null}

          {stage === "review" && displayedReviewVersion ? <section><p className={styles.kicker}>{requestedVersion ? `Historical version ${requestedVersion.number} · read only` : "Final read-through"}</p><h2>Does the promise survive the cut?</h2>{requestedVersion ? <p className={styles.historicalNote}>You opened the version attached to this team activity. <Link href={`/app/create/${item.id}?stage=review`}>Return to current version {currentVersion.number}</Link></p> : null}<div className={styles.review}><strong>{displayedReviewVersion.selectedHookText ?? itemHooks.find(({ id }) => id === displayedReviewVersion.selectedHookId)?.text}</strong><ol>{(displayedReviewVersion.outline ?? []).map((beat) => <li key={beat}>{beat}</li>)}</ol><p>{displayedReviewVersion.script}</p></div>{!requestedVersion ? <button className={styles.primaryButton} onClick={() => goToStage("ready")} type="button">Ready for handoff <ArrowRight aria-hidden="true" size={18} /></button> : null}</section> : null}
          {stage === "ready" ? <ExportPanel item={item} /> : null}
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
