"use client";

import { ArrowRight, Check, Compass, Flag, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type {
  ChosenContentDirection,
  ContributionLink,
  ThinkingContribution,
  ThinkingRoom,
  ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";

import styles from "./thinking-rooms.module.css";

interface SynthesisDraft {
  belief: string;
  confidence: ThinkingSynthesisRevision["confidence"];
  openChallengeIds: string[];
  challengeResolutionNotes: Record<string, string>;
  basis: ChosenContentDirection["basis"];
}

interface ThinkingSynthesisRailProps {
  room: ThinkingRoom;
  challenges: ThinkingContribution[];
  links: ContributionLink[];
  current?: ThinkingSynthesisRevision;
  suggestedBelief?: string;
  canEdit: boolean;
  canConvert: boolean;
  converted: boolean;
  saving: boolean;
  hasEvidenceSupport: boolean;
  conversionState: "idle" | "offline" | "permission" | "error";
  onBegin: () => void | Promise<void>;
  onConvert: () => void | Promise<void>;
  onSave: (draft: SynthesisDraft) => void | Promise<void>;
  onComposingChange?: (composing: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}

const confidenceLabels: Record<ThinkingSynthesisRevision["confidence"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function ThinkingSynthesisRail({
  room,
  challenges,
  links,
  current,
  suggestedBelief,
  canEdit,
  canConvert,
  converted,
  saving,
  hasEvidenceSupport,
  conversionState,
  onBegin,
  onConvert,
  onSave,
  onComposingChange,
  onFocusChange,
}: ThinkingSynthesisRailProps) {
  const allChallengeIds = useMemo(() => challenges.map(({ id }) => id), [challenges]);
  const initialOpenChallengeIds = useMemo(() => {
    if (!current) return allChallengeIds;
    const challengesAddedAfterRevision = allChallengeIds.filter(
      (id) => !current.sourceContributionIds.includes(id),
    );
    return [...new Set([...current.openChallengeIds, ...challengesAddedAfterRevision])];
  }, [allChallengeIds, current]);
  const [belief, setBelief] = useState(current?.belief ?? "");
  const [confidence, setConfidence] = useState<ThinkingSynthesisRevision["confidence"]>(current?.confidence ?? "medium");
  const [openChallengeIds, setOpenChallengeIds] = useState<string[]>(initialOpenChallengeIds);
  const [basis, setBasis] = useState<ChosenContentDirection["basis"]>();
  const [challengeResolutionNotes, setChallengeResolutionNotes] = useState<Record<string, string>>({});

  const editing = room.status === "synthesizing";

  return (
    <aside aria-label="Synthesis" className={styles.synthesisRail}>
      <header className={styles.synthesisHeader}>
        <span aria-hidden="true"><Compass size={21} weight="duotone" /></span>
        <div><small>Decision desk</small><h2>Synthesis</h2></div>
        {current ? <em>Revision {current.number}</em> : null}
      </header>

      {!editing ? (
        <section className={styles.synthesisSummary}>
          {current ? (
            <>
              <small>Current shared belief</small>
              <p>{current.belief}</p>
              <span>{confidenceLabels[current.confidence]} confidence</span>
              {current.openChallengeIds.length ? (
                <div className={styles.conversionWarning} role="note">
                  <WarningCircle aria-hidden="true" size={17} />
                  <p>{current.openChallengeIds.length} open challenge{current.openChallengeIds.length === 1 ? " remains" : "s remain"}. You can still create the direction, with this uncertainty attached.</p>
                </div>
              ) : null}
              <button
                disabled={converted || !canConvert || saving}
                onClick={() => void onConvert()}
                type="button"
              >
                <ArrowRight aria-hidden="true" size={18} />
                {converted ? "Direction already created" : "Create Idea Board direction"}
              </button>
              {converted ? (
                <p role="note">The source link is recorded. This Idea Board direction follows your current workspace sync status.</p>
              ) : conversionState === "permission" ? (
                <p role="alert">Your access changed before conversion. No Idea Board direction was created.</p>
              ) : conversionState === "offline" ? (
                <div role="alert"><p>You’re offline. The direction was not created.</p><button disabled={saving} onClick={() => void onConvert()} type="button">Retry conversion</button></div>
              ) : conversionState === "error" ? (
                <div role="alert"><p>The direction could not be created. The accepted synthesis is unchanged.</p><button disabled={saving} onClick={() => void onConvert()} type="button">Retry conversion</button></div>
              ) : null}
            </>
          ) : (
            <>
              <small>No synthesis yet</small>
              <p>Converge when the room has enough tension, evidence, and challenge to make a useful choice.</p>
            </>
          )}
          {canEdit && ["exploring", "decided", "converted"].includes(room.status) ? (
            <button onClick={() => void onBegin()} type="button">
              <Flag aria-hidden="true" size={18} /> {current ? "Reopen synthesis" : "Begin synthesis"}
            </button>
          ) : null}
        </section>
      ) : (
        <form className={styles.synthesisForm} onSubmit={(event) => {
          event.preventDefault();
          if (!belief.trim() || !basis || (basis === "evidence" && !hasEvidenceSupport) || saving) return;
          void onSave({ belief: belief.trim(), confidence, openChallengeIds, basis, challengeResolutionNotes });
        }}>
          <label htmlFor="thinking-shared-belief">Current shared belief</label>
          {suggestedBelief ? (
            <section aria-label="Suggested belief" className={styles.synthesisSuggestion}>
              <span>Suggested</span>
              <p>{suggestedBelief}</p>
              <button
                disabled={!canEdit}
                onClick={() => setBelief(suggestedBelief)}
                type="button"
              >
                Use suggested belief
              </button>
            </section>
          ) : null}
          <textarea
            disabled={!canEdit}
            id="thinking-shared-belief"
            maxLength={20000}
            onBlur={() => { onComposingChange?.(false); onFocusChange?.(false); }}
            onChange={(event) => { setBelief(event.target.value); onComposingChange?.(Boolean(event.target.value.trim())); }}
            onFocus={() => { onFocusChange?.(true); onComposingChange?.(Boolean(belief.trim())); }}
            placeholder="What does the room believe now?"
            rows={5}
            value={belief}
          />

          <fieldset>
            <legend>Decision confidence</legend>
            {(["low", "medium", "high"] as const).map((level) => (
              <label key={level}>
                <input
                  checked={confidence === level}
                  disabled={!canEdit}
                  name="synthesis-confidence"
                  onChange={() => setConfidence(level)}
                  type="radio"
                />
                {confidenceLabels[level]} confidence
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>What is this direction based on?</legend>
            {([
              ["evidence", "Evidence"],
              ["creator_experience", "Creator experience"],
              ["opinion", "Opinion"],
            ] as const).map(([value, label]) => (
              <label key={value}>
                <input checked={basis === value} disabled={!canEdit} name="synthesis-basis" onChange={() => setBasis(value)} type="radio" />
                {label}
              </label>
            ))}
          </fieldset>
          {basis === "evidence" && !hasEvidenceSupport ? <p role="alert">Add an Evidence note before using evidence as the basis.</p> : null}

          <section aria-labelledby="open-challenges-heading" className={styles.openChallenges}>
            <div>
              <WarningCircle aria-hidden="true" size={18} />
              <h3 id="open-challenges-heading">Open challenges</h3>
              <span>{openChallengeIds.length}</span>
            </div>
            {challenges.length ? (
              <ul>
                {challenges.map((challenge) => {
                  const open = openChallengeIds.includes(challenge.id);
                  const openLink = links.find((link) =>
                    link.relationship === "challenges" &&
                    link.resolutionStatus === "open" &&
                    (link.fromContributionId === challenge.id || link.toContributionId === challenge.id),
                  );
                  return (
                    <li data-resolved={!open} key={challenge.id}>
                      <p>{challenge.body}</p>
                      {open ? (
                        <>
                          <label>Resolution note for {challenge.body}
                            <textarea disabled={!canEdit || !openLink} onBlur={() => { onComposingChange?.(false); onFocusChange?.(false); }} onChange={(event) => { setChallengeResolutionNotes((notes) => ({ ...notes, [challenge.id]: event.target.value })); onComposingChange?.(Boolean(event.target.value.trim())); }} onFocus={(event) => { onFocusChange?.(true); onComposingChange?.(Boolean(event.currentTarget.value.trim())); }} value={challengeResolutionNotes[challenge.id] ?? ""} />
                          </label>
                          <button
                            disabled={!canEdit || !openLink || !challengeResolutionNotes[challenge.id]?.trim()}
                            onClick={() => setOpenChallengeIds((ids) => ids.filter((id) => id !== challenge.id))}
                            type="button"
                          >
                            <Check aria-hidden="true" size={15} /> Resolve challenge
                          </button>
                        </>
                      ) : (
                        <span><Check aria-hidden="true" size={15} /> Resolved in this synthesis</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className={styles.noChallenges}>No challenges have been added yet.</p>}
          </section>

          <button className={styles.saveSynthesis} disabled={!canEdit || saving || !belief.trim() || !basis || (basis === "evidence" && !hasEvidenceSupport)} type="submit">
            {saving ? "Saving…" : "Save synthesis"}
          </button>
        </form>
      )}
    </aside>
  );
}
