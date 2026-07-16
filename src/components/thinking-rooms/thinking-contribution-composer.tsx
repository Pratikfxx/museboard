"use client";

import { ArrowRight, NotePencil } from "@phosphor-icons/react";
import { forwardRef, type FormEvent } from "react";

import type { ThinkingLens } from "@/domain/thinking-rooms";

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
  disabled?: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

export const ThinkingContributionComposer = forwardRef<
  HTMLTextAreaElement,
  ThinkingContributionComposerProps
>(function ThinkingContributionComposer(
  { lens, value, disabled = false, saving = false, onChange, onSubmit },
  ref,
) {
  const label = THINKING_LENS_LABELS[lens];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || disabled || saving) return;
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
        <div className={styles.composerFooter}>
          <small>{disabled ? "You can read this room, but contribution editing is unavailable." : "Keep it atomic. You can add another thought next."}</small>
          <button disabled={disabled || saving || !value.trim()} type="submit">
            {saving ? "Saving…" : "Add contribution"} <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </form>
    </section>
  );
});
