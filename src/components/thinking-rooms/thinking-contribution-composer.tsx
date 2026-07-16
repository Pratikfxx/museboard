"use client";

import { ArrowRight, NotePencil } from "@phosphor-icons/react";
import { forwardRef, type FormEvent } from "react";

import type { ContributionLink, ThinkingContribution, ThinkingLens } from "@/domain/thinking-rooms";

import styles from "./thinking-rooms.module.css";

export const THINKING_LENS_LABELS: Record<ThinkingLens, string> = {
  audience_tensions: "Audience tensions",
  evidence: "Evidence",
  challenges: "Challenges",
  possibilities: "Possibilities",
};

interface ThinkingContributionComposerProps {
  lens: ThinkingLens;
  value: string;
  contributions: ThinkingContribution[];
  sourceReferenceId: string;
  relationshipTargetId: string;
  relationship: ContributionLink["relationship"];
  disabled?: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  onSourceReferenceChange: (value: string) => void;
  onRelationshipTargetChange: (value: string) => void;
  onRelationshipChange: (value: ContributionLink["relationship"]) => void;
  onSubmit: () => void | Promise<void>;
}

export const ThinkingContributionComposer = forwardRef<
  HTMLTextAreaElement,
  ThinkingContributionComposerProps
>(function ThinkingContributionComposer(
  { lens, value, contributions, sourceReferenceId, relationshipTargetId, relationship, disabled = false, saving = false, onChange, onSourceReferenceChange, onRelationshipTargetChange, onRelationshipChange, onSubmit },
  ref,
) {
  const label = THINKING_LENS_LABELS[lens];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || (lens === "evidence" && !sourceReferenceId.trim()) || disabled || saving) return;
    void onSubmit();
  }

  return (
    <section aria-label={`Contribution composer for ${label}`} className={styles.composer}>
      <div className={styles.composerHeading}>
        <span aria-hidden="true"><NotePencil size={20} /></span>
        <div>
          <small>One focused thought</small>
          <h2>Add to {label}</h2>
        </div>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="thinking-contribution-draft">Contribution to {label}</label>
        <textarea
          disabled={disabled}
          id="thinking-contribution-draft"
          maxLength={20000}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write the thought clearly enough for a teammate to respond to it."
          ref={ref}
          rows={3}
          value={value}
        />
        {lens === "evidence" ? (
          <label>Evidence source
            <input
              disabled={disabled}
              onChange={(event) => onSourceReferenceChange(event.target.value)}
              placeholder="Paste a URL or source reference"
              value={sourceReferenceId}
            />
          </label>
        ) : null}
        {contributions.length ? (
          <fieldset>
            <legend>Connect to another note (optional)</legend>
            <label>Related note
              <select disabled={disabled} onChange={(event) => onRelationshipTargetChange(event.target.value)} value={relationshipTargetId}>
                <option value="">No relationship</option>
                {contributions.map((contribution) => <option key={contribution.id} value={contribution.id}>Link to: {contribution.body.slice(0, 80)}</option>)}
              </select>
            </label>
            <label>Relationship
              <select disabled={disabled || !relationshipTargetId} onChange={(event) => onRelationshipChange(event.target.value as ContributionLink["relationship"])} value={relationship}>
                <option value="supports">Supports</option><option value="challenges">Challenges</option><option value="extends">Extends</option><option value="combines">Combines</option>
              </select>
            </label>
          </fieldset>
        ) : null}
        <div className={styles.composerFooter}>
          <small>{disabled ? "You can read this room, but contribution editing is unavailable." : "Keep it atomic. You can add another thought next."}</small>
          <button disabled={disabled || saving || !value.trim() || (lens === "evidence" && !sourceReferenceId.trim())} type="submit">
            {saving ? "Saving…" : "Add contribution"} <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </form>
    </section>
  );
});
