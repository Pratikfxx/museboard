"use client";

import { ArrowRight, Check, Compass, Flag, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type {
  ThinkingContribution,
  ThinkingRoom,
  ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";

import styles from "./thinking-rooms.module.css";

interface SynthesisDraft {
  belief: string;
  confidence: ThinkingSynthesisRevision["confidence"];
  openChallengeIds: string[];
}

interface ThinkingSynthesisRailProps {
  room: ThinkingRoom;
  challenges: ThinkingContribution[];
  current?: ThinkingSynthesisRevision;
  suggestedBelief?: string;
  canEdit: boolean;
  canConvert: boolean;
  converted: boolean;
  saving: boolean;
  onBegin: () => void | Promise<void>;
  onConvert: () => void | Promise<void>;
  onSave: (draft: SynthesisDraft) => void | Promise<void>;
}

const confidenceLabels: Record<ThinkingSynthesisRevision["confidence"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function ThinkingSynthesisRail({
  room,
  challenges,
  current,
  suggestedBelief,
  canEdit,
  canConvert,
  converted,
  saving,
  onBegin,
  onConvert,
  onSave,
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
          if (!belief.trim() || saving) return;
          void onSave({ belief: belief.trim(), confidence, openChallengeIds });
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
            onChange={(event) => setBelief(event.target.value)}
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
                  return (
                    <li data-resolved={!open} key={challenge.id}>
                      <p>{challenge.body}</p>
                      {open ? (
                        <button
                          disabled={!canEdit}
                          onClick={() => setOpenChallengeIds((ids) => ids.filter((id) => id !== challenge.id))}
                          type="button"
                        >
                          <Check aria-hidden="true" size={15} /> Resolve challenge
                        </button>
                      ) : (
                        <span><Check aria-hidden="true" size={15} /> Resolved in this synthesis</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className={styles.noChallenges}>No challenges have been added yet.</p>}
          </section>

          <button className={styles.saveSynthesis} disabled={!canEdit || saving || !belief.trim()} type="submit">
            {saving ? "Saving…" : "Save synthesis"}
          </button>
        </form>
      )}
    </aside>
  );
}
